// ============================================================================
// AQL Aggregate Function — Comprehensive Unit Tests
// Covers: Parser, Chip Pipeline, Serializer, Suggestion Engine
// ============================================================================

import { describe, it, expect } from 'vitest';
import { parse } from '../parser';
import { serializeForBackend } from '../serializer';
import { queryToChips, chipsToQuery } from '../useFilterChips';
import { getSuggestions, isIncompleteQuery } from '../suggestion-engine';
import { tokenize } from '../lexer';
import { resolveCursorContext } from '../cursor-context';
import { DISCOVER_CONFIG, PERFORMANCE_CONFIG, LOGS_CONFIG, RELEASES_CONFIG } from '../fields';
import type { AggregateFilterExpression } from '../types';
import { validate } from '../validator';
import { formatQuery } from '../formatter';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build aggregateNames Set from a DomainConfig */
function aggNames(config: typeof DISCOVER_CONFIG): Set<string> {
  return new Set(config.aggregates?.map((a) => a.name.toLowerCase()) ?? []);
}

/** Parse with aggregate awareness from a config */
function parseAgg(input: string, config = DISCOVER_CONFIG) {
  return parse(input, aggNames(config));
}

/** Serialize via parse → AST → serializeForBackend */
function serializeAgg(input: string, config = DISCOVER_CONFIG): string {
  const { ast } = parseAgg(input, config);
  return serializeForBackend(ast);
}

/** Parse to chips with aggregate awareness */
function toChips(input: string, config = DISCOVER_CONFIG) {
  return queryToChips(input, aggNames(config));
}

// ─── Parser ──────────────────────────────────────────────────────────────────

describe('Aggregate Parser', () => {
  describe('zero-arg functions', () => {
    it('should parse count():>100', () => {
      const { ast, errors } = parseAgg('count():>100');
      expect(errors).toHaveLength(0);
      expect(ast).toMatchObject({
        type: 'AggregateFilter',
        funcName: 'count',
        args: [],
        operator: '>',
        value: 100,
      });
    });

    it('should parse count():100 (implicit =)', () => {
      const { ast, errors } = parseAgg('count():100');
      expect(errors).toHaveLength(0);
      expect(ast).toMatchObject({
        type: 'AggregateFilter',
        funcName: 'count',
        args: [],
        operator: '=',
        value: 100,
      });
    });

    it('should parse count():>=500', () => {
      const { ast } = parseAgg('count():>=500');
      expect(ast).toMatchObject({
        type: 'AggregateFilter',
        funcName: 'count',
        operator: '>=',
        value: 500,
      });
    });

    it('should parse count():<=10', () => {
      const { ast } = parseAgg('count():<=10');
      expect(ast).toMatchObject({
        type: 'AggregateFilter',
        funcName: 'count',
        operator: '<=',
        value: 10,
      });
    });

    it('should parse count():!=0', () => {
      const { ast } = parseAgg('count():!=0');
      expect(ast).toMatchObject({
        type: 'AggregateFilter',
        funcName: 'count',
        operator: '!=',
        value: 0,
      });
    });

    it('should parse failure_rate():>0.05', () => {
      const { ast } = parseAgg('failure_rate():>0.05');
      expect(ast).toMatchObject({
        type: 'AggregateFilter',
        funcName: 'failure_rate',
        args: [],
        operator: '>',
        value: 0.05,
      });
    });

    it('should parse tpm():>=1000', () => {
      const { ast } = parseAgg('tpm():>=1000');
      expect(ast).toMatchObject({
        type: 'AggregateFilter',
        funcName: 'tpm',
        args: [],
        operator: '>=',
        value: 1000,
      });
    });
  });

  describe('single-arg functions', () => {
    it('should parse avg(duration):>500', () => {
      const { ast, errors } = parseAgg('avg(duration):>500');
      expect(errors).toHaveLength(0);
      expect(ast).toMatchObject({
        type: 'AggregateFilter',
        funcName: 'avg',
        args: ['duration'],
        operator: '>',
        value: 500,
      });
    });

    it('should parse p95(duration):>1000', () => {
      const { ast } = parseAgg('p95(duration):>1000');
      expect(ast).toMatchObject({
        type: 'AggregateFilter',
        funcName: 'p95',
        args: ['duration'],
        operator: '>',
        value: 1000,
      });
    });

    it('should parse p50(duration):<=200', () => {
      const { ast } = parseAgg('p50(duration):<=200');
      expect(ast).toMatchObject({
        type: 'AggregateFilter',
        funcName: 'p50',
        args: ['duration'],
        operator: '<=',
        value: 200,
      });
    });

    it('should parse p75(duration):>300', () => {
      const { ast } = parseAgg('p75(duration):>300');
      expect(ast).toMatchObject({
        type: 'AggregateFilter',
        funcName: 'p75',
        args: ['duration'],
        operator: '>',
        value: 300,
      });
    });

    it('should parse p99(duration):>5000', () => {
      const { ast } = parseAgg('p99(duration):>5000');
      expect(ast).toMatchObject({
        type: 'AggregateFilter',
        funcName: 'p99',
        args: ['duration'],
        operator: '>',
        value: 5000,
      });
    });

    it('should parse sum(duration):>10000', () => {
      const { ast } = parseAgg('sum(duration):>10000');
      expect(ast).toMatchObject({
        type: 'AggregateFilter',
        funcName: 'sum',
        args: ['duration'],
        operator: '>',
      });
    });

    it('should parse min(duration):<100', () => {
      const { ast } = parseAgg('min(duration):<100');
      expect(ast).toMatchObject({
        type: 'AggregateFilter',
        funcName: 'min',
        args: ['duration'],
        operator: '<',
        value: 100,
      });
    });

    it('should parse max(duration):>3000', () => {
      const { ast } = parseAgg('max(duration):>3000');
      expect(ast).toMatchObject({
        type: 'AggregateFilter',
        funcName: 'max',
        args: ['duration'],
        operator: '>',
        value: 3000,
      });
    });

    it('should parse uniq(service):>5', () => {
      const { ast } = parseAgg('uniq(service):>5');
      expect(ast).toMatchObject({
        type: 'AggregateFilter',
        funcName: 'uniq',
        args: ['service'],
        operator: '>',
        value: 5,
      });
    });

    it('should parse apdex(300):>0.7', () => {
      const { ast } = parseAgg('apdex(300):>0.7');
      expect(ast).toMatchObject({
        type: 'AggregateFilter',
        funcName: 'apdex',
        args: ['300'],
        operator: '>',
        value: 0.7,
      });
    });
  });

  describe('string values', () => {
    it('should parse count():high (unquoted string)', () => {
      const { ast } = parseAgg('count():high');
      expect(ast).toMatchObject({
        type: 'AggregateFilter',
        funcName: 'count',
        args: [],
        operator: '=',
        value: 'high',
        quoted: false,
      });
    });

    it('should parse count():"many items" (quoted string)', () => {
      const { ast } = parseAgg('count():"many items"');
      expect(ast).toMatchObject({
        type: 'AggregateFilter',
        funcName: 'count',
        args: [],
        operator: '=',
        value: 'many items',
        quoted: true,
      });
    });
  });

  describe('combined with regular filters', () => {
    it('should parse filter AND aggregate', () => {
      const { ast, errors } = parseAgg(
        'service:web and count():>100'
      );
      expect(errors).toHaveLength(0);
      expect(ast).toMatchObject({
        type: 'Binary',
        operator: 'and',
        left: { type: 'Filter', field: 'service', value: 'web' },
        right: {
          type: 'AggregateFilter',
          funcName: 'count',
          operator: '>',
          value: 100,
        },
      });
    });

    it('should parse aggregate AND filter', () => {
      const { ast } = parseAgg('p95(duration):>1000 and service:api');
      expect(ast).toMatchObject({
        type: 'Binary',
        operator: 'and',
        left: { type: 'AggregateFilter', funcName: 'p95' },
        right: { type: 'Filter', field: 'service', value: 'api' },
      });
    });

    it('should parse aggregate OR aggregate', () => {
      const { ast } = parseAgg('count():>100 or p95(duration):>1000');
      expect(ast).toMatchObject({
        type: 'Binary',
        operator: 'or',
        left: { type: 'AggregateFilter', funcName: 'count' },
        right: { type: 'AggregateFilter', funcName: 'p95' },
      });
    });

    it('should parse NOT aggregate', () => {
      const { ast } = parseAgg('not count():>100');
      expect(ast).toMatchObject({
        type: 'Not',
        expression: { type: 'AggregateFilter', funcName: 'count' },
      });
    });

    it('should parse grouped aggregate', () => {
      const { ast } = parseAgg(
        '(count():>100 or p95(duration):>500) and service:web'
      );
      expect(ast).toMatchObject({
        type: 'Binary',
        operator: 'and',
        left: {
          type: 'Group',
          expression: {
            type: 'Binary',
            operator: 'or',
            left: { type: 'AggregateFilter', funcName: 'count' },
            right: { type: 'AggregateFilter', funcName: 'p95' },
          },
        },
        right: { type: 'Filter', field: 'service' },
      });
    });

    it('should handle 3+ chained expressions with aggregates', () => {
      const { ast, errors } = parseAgg(
        'service:web and count():>100 and p95(duration):>500'
      );
      expect(errors).toHaveLength(0);
      // a and b and c → (a and b) and c (left-associative)
      expect(ast).toMatchObject({
        type: 'Binary',
        operator: 'and',
        left: {
          type: 'Binary',
          operator: 'and',
          left: { type: 'Filter', field: 'service' },
          right: { type: 'AggregateFilter', funcName: 'count' },
        },
        right: { type: 'AggregateFilter', funcName: 'p95' },
      });
    });
  });

  describe('disambiguation: non-aggregate field + LPAREN', () => {
    it('should NOT treat unknown function as aggregate', () => {
      // "foobar" is not in aggregateNames → should be Group or FreeText
      const { ast } = parseAgg('foobar(something)');
      // Without aggregateNames match, "foobar" is FreeText, then ( starts Group
      expect(ast?.type).not.toBe('AggregateFilter');
    });

    it('should treat bare ( as group expression', () => {
      const { ast } = parseAgg('(service:web)');
      expect(ast).toMatchObject({
        type: 'Group',
        expression: { type: 'Filter', field: 'service' },
      });
    });

    it('should not parse aggregate when no aggregateNames provided', () => {
      // Without aggregateNames, "count" is just a regular FIELD
      const { ast } = parse('count():>100'); // no aggregateNames
      expect(ast?.type).not.toBe('AggregateFilter');
    });
  });

  describe('error recovery', () => {
    it('should handle unclosed paren: count(', () => {
      const { ast, errors } = parseAgg('count(');
      // count is aggregate → parseAggregateFilter tries to consume args
      // but hits EOF before RPAREN
      expect(
        errors.some((e) => e.type === 'UNCLOSED_PAREN')
      ).toBe(true);
    });

    it('should handle incomplete aggregate: count():', () => {
      const { ast } = parseAgg('count():');
      // count() with colon but no value
      const aggNode = ast as AggregateFilterExpression;
      expect(aggNode.type).toBe('AggregateFilter');
      expect(aggNode.funcName).toBe('count');
    });

    it('should handle aggregate with colon and operator but no value: count():>', () => {
      const { ast, errors } = parseAgg('count():>');
      // Should produce an INCOMPLETE_FILTER error
      expect(
        errors.some((e) => e.type === 'INCOMPLETE_FILTER')
      ).toBe(true);
    });

    it('should handle count() without colon (partial)', () => {
      const { ast } = parseAgg('count()');
      const aggNode = ast as AggregateFilterExpression;
      expect(aggNode.type).toBe('AggregateFilter');
      expect(aggNode.funcName).toBe('count');
      expect(aggNode.value).toBe('');
    });
  });

  describe('case sensitivity', () => {
    it('should match aggregate names case-insensitively', () => {
      const { ast: lower } = parseAgg('count():>10');
      expect(lower?.type).toBe('AggregateFilter');

      const { ast: upper } = parseAgg('COUNT():>10');
      expect(upper?.type).toBe('AggregateFilter');
      expect((upper as AggregateFilterExpression).funcName).toBe('COUNT');

      const { ast: mixed } = parseAgg('Count():>10');
      expect(mixed?.type).toBe('AggregateFilter');
    });
  });

  describe('position tracking', () => {
    it('should track start/end positions', () => {
      const { ast } = parseAgg('count():>100');
      const aggNode = ast as AggregateFilterExpression;
      expect(aggNode.start).toBe(0);
      expect(aggNode.end).toBeGreaterThan(0);
    });

    it('should track position in compound expression', () => {
      const input = 'service:web and count():>100';
      const { ast } = parseAgg(input);
      // Binary → right is aggregate, should start after "and "
      expect(ast?.type).toBe('Binary');
      const right = (ast as any).right as AggregateFilterExpression;
      expect(right.type).toBe('AggregateFilter');
      expect(right.start).toBeGreaterThan(0);
    });
  });
});

// ─── Chip Pipeline ───────────────────────────────────────────────────────────

describe('Aggregate Chip Pipeline', () => {
  describe('queryToChips', () => {
    it('should create aggregate chip for count():>100', () => {
      const chips = toChips('count():>100');
      expect(chips).toHaveLength(1);
      expect(chips[0].type).toBe('aggregate');
      expect(chips[0].aggregateFunc).toBe('count');
      expect(chips[0].aggregateArgs).toEqual([]);
      expect(chips[0].operator).toBe('>');
      expect(chips[0].value).toBe('100');
    });

    it('should create aggregate chip for avg(duration):>500', () => {
      const chips = toChips('avg(duration):>500');
      expect(chips).toHaveLength(1);
      expect(chips[0].type).toBe('aggregate');
      expect(chips[0].aggregateFunc).toBe('avg');
      expect(chips[0].aggregateArgs).toEqual(['duration']);
      expect(chips[0].operator).toBe('>');
      expect(chips[0].value).toBe('500');
    });

    it('should create aggregate chip for p95(duration):>1000', () => {
      const chips = toChips('p95(duration):>1000');
      expect(chips).toHaveLength(1);
      expect(chips[0].aggregateFunc).toBe('p95');
      expect(chips[0].aggregateArgs).toEqual(['duration']);
    });

    it('should create mixed filter and aggregate chips', () => {
      const chips = toChips('service:web and count():>100');
      expect(chips).toHaveLength(3); // filter, AND, aggregate
      expect(chips[0].type).toBe('filter');
      expect(chips[0].field).toBe('service');
      expect(chips[1].type).toBe('logical');
      expect(chips[1].label).toBe('AND');
      expect(chips[2].type).toBe('aggregate');
      expect(chips[2].aggregateFunc).toBe('count');
    });

    it('should handle count() without value', () => {
      const chips = toChips('count()');
      expect(chips).toHaveLength(1);
      expect(chips[0].type).toBe('aggregate');
      expect(chips[0].aggregateFunc).toBe('count');
      expect(chips[0].value).toBe('');
    });
  });

  describe('chipsToQuery', () => {
    it('should roundtrip count():>100', () => {
      const chips = toChips('count():>100');
      const query = chipsToQuery(chips);
      expect(query).toBe('count():>100');
    });

    it('should roundtrip avg(duration):>500', () => {
      const chips = toChips('avg(duration):>500');
      const query = chipsToQuery(chips);
      expect(query).toBe('avg(duration):>500');
    });

    it('should roundtrip p95(duration):>1000', () => {
      const chips = toChips('p95(duration):>1000');
      const query = chipsToQuery(chips);
      expect(query).toBe('p95(duration):>1000');
    });

    it('should roundtrip count():100 (implicit =)', () => {
      const chips = toChips('count():100');
      const query = chipsToQuery(chips);
      expect(query).toBe('count():100');
    });

    it('should roundtrip mixed filter and aggregate', () => {
      const chips = toChips('service:web AND count():>100');
      const query = chipsToQuery(chips);
      expect(query).toBe('service:web AND count():>100');
    });

    it('should roundtrip aggregate without value', () => {
      const chips = toChips('count()');
      const query = chipsToQuery(chips);
      expect(query).toBe('count()');
    });

    it('should roundtrip complex expression', () => {
      const input =
        'service:web AND count():>100 AND p95(duration):>500';
      const chips = toChips(input);
      const query = chipsToQuery(chips);
      expect(query).toBe(input);
    });
  });
});

// ─── Serializer ──────────────────────────────────────────────────────────────

describe('Aggregate Serializer', () => {
  it('should serialize count():>100', () => {
    expect(serializeAgg('count():>100')).toBe('count():>100');
  });

  it('should serialize count():100 (implicit =)', () => {
    expect(serializeAgg('count():100')).toBe('count():100');
  });

  it('should serialize avg(duration):>500', () => {
    expect(serializeAgg('avg(duration):>500')).toBe('avg(duration):>500');
  });

  it('should serialize p95(duration):>1000', () => {
    expect(serializeAgg('p95(duration):>1000')).toBe('p95(duration):>1000');
  });

  it('should serialize with AND', () => {
    expect(serializeAgg('service:web and count():>100')).toBe(
      'service:web AND count():>100'
    );
  });

  it('should serialize NOT aggregate', () => {
    expect(serializeAgg('not count():>100')).toBe('!count():>100');
  });

  it('should serialize grouped aggregates', () => {
    expect(
      serializeAgg('(count():>100 or p95(duration):>500) and service:web')
    ).toBe('(count():>100 OR p95(duration):>500) AND service:web');
  });

  it('should serialize failure_rate():>0.05', () => {
    expect(serializeAgg('failure_rate():>0.05')).toBe('failure_rate():>0.05');
  });
});

// ─── Suggestion Engine ───────────────────────────────────────────────────────

describe('Aggregate Suggestions', () => {
  function fieldSuggestions(input: string, config = DISCOVER_CONFIG) {
    const tokens = tokenize(input);
    const ctx = resolveCursorContext(input, input.length, tokens);
    const chips = queryToChips(input, aggNames(config));
    return getSuggestions(ctx, config, undefined, 100, chips);
  }

  it('should suggest aggregate functions in FIELD context', () => {
    const suggestions = fieldSuggestions('', DISCOVER_CONFIG);
    const aggSugs = suggestions.filter((s) => s.category === 'aggregate');
    expect(aggSugs.length).toBeGreaterThan(0);
    const aggNames = aggSugs.map((s) => s.label.split('(')[0]);
    expect(aggNames).toContain('count');
    expect(aggNames).toContain('avg');
    expect(aggNames).toContain('p95');
  });

  it('should filter aggregate suggestions by prefix', () => {
    const suggestions = fieldSuggestions('cou');
    const aggSugs = suggestions.filter((s) => s.category === 'aggregate');
    expect(aggSugs.length).toBe(1);
    expect(aggSugs[0].label).toMatch(/^count/);
  });

  it('should filter aggregate suggestions by prefix "p"', () => {
    const suggestions = fieldSuggestions('p');
    const aggSugs = suggestions.filter((s) => s.category === 'aggregate');
    expect(aggSugs.some((s) => s.label.startsWith('p50'))).toBe(true);
    expect(aggSugs.some((s) => s.label.startsWith('p75'))).toBe(true);
    expect(aggSugs.some((s) => s.label.startsWith('p95'))).toBe(true);
    expect(aggSugs.some((s) => s.label.startsWith('p99'))).toBe(true);
  });

  it('should not suggest aggregates not in domain config', () => {
    const suggestions = fieldSuggestions('p9', RELEASES_CONFIG);
    const aggSugs = suggestions.filter((s) => s.category === 'aggregate');
    expect(aggSugs).toHaveLength(0);
  });

  it('should suggest aggregates for performance domain', () => {
    const suggestions = fieldSuggestions('', PERFORMANCE_CONFIG);
    const aggSugs = suggestions.filter((s) => s.category === 'aggregate');
    expect(aggSugs.some((s) => s.label.startsWith('count'))).toBe(true);
    expect(aggSugs.some((s) => s.label.startsWith('p95'))).toBe(true);
    expect(aggSugs.some((s) => s.label.startsWith('failure_rate'))).toBe(true);
    expect(aggSugs.some((s) => s.label.startsWith('apdex'))).toBe(true);
  });

  it('should have correct insertText for zero-arg functions', () => {
    const suggestions = fieldSuggestions('');
    const countSug = suggestions.find(
      (s) => s.category === 'aggregate' && s.label.startsWith('count')
    );
    expect(countSug).toBeDefined();
    expect(countSug!.insertText).toBe('count():');
  });

  it('should have correct insertText for single-arg functions', () => {
    const suggestions = fieldSuggestions('');
    const avgSug = suggestions.find(
      (s) => s.category === 'aggregate' && s.label.startsWith('avg')
    );
    expect(avgSug).toBeDefined();
    expect(avgSug!.insertText).toBe('avg(');
  });
});

// ─── Domain Config ───────────────────────────────────────────────────────────

describe('Domain Config Aggregates', () => {
  it('DISCOVER_CONFIG has all common aggregates', () => {
    const names = DISCOVER_CONFIG.aggregates?.map((a) => a.name) ?? [];
    expect(names).toContain('count');
    expect(names).toContain('avg');
    expect(names).toContain('sum');
    expect(names).toContain('p50');
    expect(names).toContain('p95');
    expect(names).toContain('failure_rate');
    expect(names).toContain('apdex');
    expect(names).toContain('tpm');
  });

  it('PERFORMANCE_CONFIG has performance-specific aggregates', () => {
    const names = PERFORMANCE_CONFIG.aggregates?.map((a) => a.name) ?? [];
    expect(names).toContain('p50');
    expect(names).toContain('p95');
    expect(names).toContain('failure_rate');
    expect(names).toContain('apdex');
    expect(names).toContain('tpm');
  });

  it('LOGS_CONFIG has log-appropriate aggregates', () => {
    const names = LOGS_CONFIG.aggregates?.map((a) => a.name) ?? [];
    expect(names).toContain('count');
    expect(names).toContain('avg');
    expect(names).toContain('p95');
    // Logs shouldn't have performance-only aggregates
    expect(names).not.toContain('apdex');
    expect(names).not.toContain('tpm');
    expect(names).not.toContain('failure_rate');
  });

  it('each AggregateFunctionDef has required fields', () => {
    for (const agg of DISCOVER_CONFIG.aggregates ?? []) {
      expect(agg.name).toBeTruthy();
      expect(agg.label).toBeTruthy();
      expect(agg.description).toBeTruthy();
      expect(Array.isArray(agg.args)).toBe(true);
      expect(agg.returnType).toBeTruthy();
    }
  });
});

// ─── isIncompleteQuery ───────────────────────────────────────────────────────

describe('Aggregate isIncompleteQuery', () => {
  it('identifies incomplete aggregate patterns', () => {
    expect(isIncompleteQuery('count(')).toBe(true);
    expect(isIncompleteQuery('avg(')).toBe(true);
    expect(isIncompleteQuery('count()')).toBe(true);
    expect(isIncompleteQuery('avg(duration)')).toBe(true);
    expect(isIncompleteQuery('count():')).toBe(true);
    expect(isIncompleteQuery('count():>')).toBe(true);
  });

  it('identifies complete aggregate queries', () => {
    expect(isIncompleteQuery('count():>100')).toBe(false);
    expect(isIncompleteQuery('avg(duration):>500')).toBe(false);
    expect(isIncompleteQuery('p95(duration):>1000')).toBe(false);
    expect(isIncompleteQuery('count():100')).toBe(false);
  });
});

// ─── Validator ───────────────────────────────────────────────────────────────

describe('Aggregate Validator', () => {
  it('should accept known aggregate function', () => {
    const { ast } = parseAgg('count():>100');
    const errors = validate(ast, DISCOVER_CONFIG);
    expect(errors).toHaveLength(0);
  });

  it('should accept aggregate with correct arg count', () => {
    const { ast } = parseAgg('avg(duration):>500');
    const errors = validate(ast, DISCOVER_CONFIG);
    expect(errors).toHaveLength(0);
  });

  it('should reject unknown aggregate function', () => {
    // Force an AggregateFilter AST with unknown function name
    const unknownAgg: AggregateFilterExpression = {
      type: 'AggregateFilter',
      funcName: 'unknown_func',
      args: [],
      operator: '>',
      value: 100,
      quoted: false,
      start: 0,
      end: 20,
    };
    const errors = validate(unknownAgg, DISCOVER_CONFIG);
    expect(errors.some((e) => e.type === 'UNKNOWN_AGGREGATE')).toBe(true);
  });

  it('should reject wrong arg count', () => {
    // avg expects 1 arg but provide 0
    const wrongArgs: AggregateFilterExpression = {
      type: 'AggregateFilter',
      funcName: 'avg',
      args: [],
      operator: '>',
      value: 100,
      quoted: false,
      start: 0,
      end: 10,
    };
    const errors = validate(wrongArgs, DISCOVER_CONFIG);
    expect(errors.some((e) => e.type === 'INVALID_AGGREGATE_ARGS')).toBe(true);
  });
});

// ─── Formatter ───────────────────────────────────────────────────────────────

describe('Aggregate Formatter', () => {
  it('should format count():>100', () => {
    const { ast } = parseAgg('count():>100');
    expect(formatQuery(ast)).toBe('count():>100');
  });

  it('should format avg(duration):>500', () => {
    const { ast } = parseAgg('avg(duration):>500');
    expect(formatQuery(ast)).toBe('avg(duration):>500');
  });

  it('should format count():100 (implicit =)', () => {
    const { ast } = parseAgg('count():100');
    expect(formatQuery(ast)).toBe('count():100');
  });

  it('should format compound with aggregate', () => {
    const { ast } = parseAgg('service:web and count():>100');
    expect(formatQuery(ast)).toContain('count():>100');
  });

  it('should format NOT aggregate', () => {
    const { ast } = parseAgg('not count():>100');
    expect(formatQuery(ast)).toBe('not count():>100');
  });
});
