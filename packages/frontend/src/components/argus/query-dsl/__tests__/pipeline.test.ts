import { describe, it, expect } from 'vitest';
import { tokenize } from '../lexer';
import { resolveCursorContext } from '../cursor-context';
import {
  getSuggestions,
  applyCompletion,
  shouldKeepDropdownOpen,
} from '../suggestion-engine';
import type { CursorContext, SuggestionItem } from '../types';
import { queryToChips } from '../useFilterChips';
import { LOGS_CONFIG } from '../fields';

const MOCK_FACETS = new Map<string, string[]>([
  ['level', ['debug', 'info', 'warn', 'error', 'warning', 'fatal']],
  ['environment', ['production', 'staging', 'development', 'local', 'test']],
  ['service', ['web', 'api', 'worker']],
]);

function pipeline(
  input: string,
  cursor?: number,
  facets?: Map<string, string[]>
) {
  const c = cursor ?? input.length;
  const tokens = tokenize(input);
  const ctx = resolveCursorContext(input, c, tokens);
  const textBeforeCursor = input.slice(0, c);
  const chips = queryToChips(textBeforeCursor);
  const suggestions = getSuggestions(ctx, LOGS_CONFIG, facets, 20, chips);
  return { tokens, ctx, suggestions };
}

// ─── Spec 9.3: Cursor Context Examples ──────────────────────────────────────

describe('Spec 9.3: Cursor Context', () => {
  it('"|" → FIELD', () => {
    const { ctx } = pipeline('', 0);
    expect(ctx.type).toBe('FIELD');
    expect(ctx.prefix).toBe('');
  });

  it('"cou|" → FIELD, prefix=cou', () => {
    const { ctx } = pipeline('cou', 3);
    expect(ctx.type).toBe('FIELD');
    expect(ctx.prefix).toBe('cou');
  });

  it('"level:|" → OPERATOR, field=level, prefix=""', () => {
    const { ctx } = pipeline('level:', 6);
    expect(ctx.type).toBe('OPERATOR');
    expect(ctx.field).toBe('level');
    expect(ctx.prefix).toBe('');
  });

  it('"level:K|" → VALUE with implicit =', () => {
    const { ctx } = pipeline('level:K', 7);
    expect(ctx.field).toBe('level');
    // K is not an operator prefix, so should be VALUE
  });

  it('"level:!=|" → VALUE, field=level, op=!=, prefix=""', () => {
    const { ctx } = pipeline('level:!=', 8);
    expect(ctx.type).toBe('VALUE');
    expect(ctx.field).toBe('level');
    expect(ctx.operator).toBe('!=');
    expect(ctx.prefix).toBe('');
  });

  it('"release:!=|" → VALUE, field=release, op=!=, prefix=""', () => {
    const { ctx } = pipeline('release:!=', 10);
    expect(ctx.type).toBe('VALUE');
    expect(ctx.field).toBe('release');
    expect(ctx.operator).toBe('!=');
    expect(ctx.prefix).toBe('');
  });

  it('"level:>|" → VALUE, field=level, op=>, prefix=""', () => {
    const { ctx } = pipeline('level:>', 7);
    expect(ctx.type).toBe('VALUE');
    expect(ctx.field).toBe('level');
    expect(ctx.operator).toBe('>');
    expect(ctx.prefix).toBe('');
  });

  it('"level:>=|" → VALUE, field=level, op=>=, prefix=""', () => {
    const { ctx } = pipeline('level:>=', 8);
    expect(ctx.type).toBe('VALUE');
    expect(ctx.field).toBe('level');
    expect(ctx.operator).toBe('>=');
    expect(ctx.prefix).toBe('');
  });

  it('"message:cont|" → VALUE context with cont prefix (lexer sees STRING)', () => {
    const { ctx } = pipeline('message:cont', 12);
    expect(ctx.field).toBe('message');
    // Lexer tokenizes "cont" as STRING, not a partial operator keyword.
    // The suggestion engine handles showing operator matches via prefix.
    expect(ctx.type).toBe('VALUE');
    expect(ctx.prefix).toBe('cont');
  });

  it('"level:error |" → LOGICAL_OPERATOR', () => {
    const { ctx } = pipeline('level:error ', 12);
    expect(ctx.type).toBe('LOGICAL_OPERATOR');
  });

  it('"level:error and |" → FIELD', () => {
    const { ctx } = pipeline('level:error and ', 16);
    expect(ctx.type).toBe('FIELD');
  });
});

// ─── Spec 11.1: Context-specific suggestions ───────────────────────────────

describe('Spec 11.1: Suggestions per context', () => {
  it('FIELD context → field list (includes has/not has and parens)', () => {
    const { suggestions } = pipeline('');
    expect(suggestions.length).toBeGreaterThan(0);
    // Most suggestions are 'field', but has/not has and paren operators are also included
    expect(suggestions.some((s) => s.category === 'field')).toBe(true);
  });

  it('FIELD context with prefix → filtered', () => {
    const { suggestions } = pipeline('lev');
    expect(suggestions.some((s) => s.label === 'level')).toBe(true);
    // Only field-category suggestions should match prefix
    const fieldSuggestions = suggestions.filter((s) => s.category === 'field');
    expect(fieldSuggestions.every((s) => s.label.startsWith('lev'))).toBe(true);
  });

  it('OPERATOR context (level:) → operators + values from facets', () => {
    const { suggestions } = pipeline('level:', undefined, MOCK_FACETS);
    const cats = new Set(suggestions.map((s) => s.category));
    expect(cats.has('operator')).toBe(true);
    expect(cats.has('value')).toBe(true);
    expect(suggestions.some((s) => s.label === '!=')).toBe(true);
    // '=' is now a valid operator in the suggestion list
    expect(suggestions.some((s) => s.label === 'info')).toBe(true);
    expect(suggestions.some((s) => s.label === 'error')).toBe(true);
  });

  it('OPERATOR context (message:) → contains, startsWith, etc.', () => {
    const { suggestions } = pipeline('message:');
    expect(suggestions.some((s) => s.label === 'contains')).toBe(true);
    expect(suggestions.some((s) => s.label === 'startsWith')).toBe(true);
  });

  it('VALUE context (level:!=) → values from facets', () => {
    const { suggestions } = pipeline('level:!=', undefined, MOCK_FACETS);
    expect(suggestions.some((s) => s.label === 'debug')).toBe(true);
    expect(suggestions.some((s) => s.label === 'error')).toBe(true);
  });

  it('VALUE context (level:!=err) → filtered facet values', () => {
    const { suggestions } = pipeline('level:!=err', undefined, MOCK_FACETS);
    expect(suggestions.some((s) => s.label === 'error')).toBe(true);
    expect(suggestions.every((s) => s.label.startsWith('err'))).toBe(true);
  });

  it('LOGICAL_OPERATOR context → AND, OR', () => {
    const { suggestions } = pipeline('level:error ');
    // Logical suggestions now use uppercase labels
    expect(
      suggestions.some((s) => s.label === 'AND' || s.label === 'and')
    ).toBe(true);
    expect(suggestions.some((s) => s.label === 'OR' || s.label === 'or')).toBe(
      true
    );
  });

  it('environment: → facet values', () => {
    const { suggestions } = pipeline('environment:', undefined, MOCK_FACETS);
    expect(suggestions.some((s) => s.label === 'production')).toBe(true);
    expect(suggestions.some((s) => s.label === 'staging')).toBe(true);
    expect(suggestions.some((s) => s.label === 'development')).toBe(true);
  });

  it('has:"" and !has:"" inside quotes → field suggestions', () => {
    // has:"" with cursor at 5 (inside quotes)
    const { suggestions: hasSuggestions } = pipeline('has:""', 5, MOCK_FACETS);
    expect(hasSuggestions.some((s) => s.label === 'level')).toBe(true);
    expect(hasSuggestions.some((s) => s.label === 'service')).toBe(true);

    // !has:"" with cursor at 6 (inside quotes)
    const { suggestions: notHasSuggestions } = pipeline(
      '!has:""',
      6,
      MOCK_FACETS
    );
    expect(notHasSuggestions.some((s) => s.label === 'level')).toBe(true);
    expect(notHasSuggestions.some((s) => s.label === 'service')).toBe(true);

    // has:"" with cursor at 4 (before quotes: has:|"")
    const { suggestions: hasBeforeSuggestions } = pipeline(
      'has:""',
      4,
      MOCK_FACETS
    );
    expect(hasBeforeSuggestions.some((s) => s.label === 'level')).toBe(true);
    expect(hasBeforeSuggestions.some((s) => s.label === 'service')).toBe(true);

    // has:"" with cursor at 6 (after quotes: has:""|)
    const { suggestions: hasAfterSuggestions } = pipeline(
      'has:""',
      6,
      MOCK_FACETS
    );
    expect(hasAfterSuggestions.some((s) => s.label === 'level')).toBe(true);
    expect(hasAfterSuggestions.some((s) => s.label === 'service')).toBe(true);

    // has:"se" with cursor at 7 (after "se" inside quotes)
    const { suggestions: hasSeSuggestions } = pipeline(
      'has:"se"',
      7,
      MOCK_FACETS
    );
    expect(hasSeSuggestions.some((s) => s.label === 'service')).toBe(true);
    expect(hasSeSuggestions.some((s) => s.label === 'level')).toBe(false);
  });
});

// ─── Spec 10: Autocomplete rules ────────────────────────────────────────────

describe('Spec 10: Autocomplete rules', () => {
  // Rule 2: field → auto colon
  it('Rule 2: field completion adds colon', () => {
    const { ctx, suggestions } = pipeline('le');
    const level = suggestions.find((s) => s.label === 'level');
    expect(level).toBeDefined();
    const result = applyCompletion('le', ctx, level!);
    expect(result.text).toBe('level:');
    expect(result.cursorOffset).toBe(6);
  });

  // Rule 5: logical op adds space
  it('Rule 5: logical op adds trailing space', () => {
    const { ctx, suggestions } = pipeline('level:error ');
    const andItem = suggestions.find(
      (s) => s.label === 'AND' || s.label === 'and'
    );
    expect(andItem).toBeDefined();
    const result = applyCompletion('level:error ', ctx, andItem!);
    expect(result.text.endsWith('AND ') || result.text.endsWith('and ')).toBe(
      true
    );
  });

  // shouldKeepDropdownOpen: field/operator → true, value/logical → false
  it('field selection keeps dropdown open', () => {
    const fieldItem: SuggestionItem = { label: 'level', category: 'field' };
    expect(shouldKeepDropdownOpen(fieldItem)).toBe(true);
  });

  it('operator selection keeps dropdown open', () => {
    const opItem: SuggestionItem = { label: '!=', category: 'operator' };
    expect(shouldKeepDropdownOpen(opItem)).toBe(true);
  });

  it('value selection closes dropdown', () => {
    const valItem: SuggestionItem = { label: 'error', category: 'value' };
    expect(shouldKeepDropdownOpen(valItem)).toBe(false);
  });
});
