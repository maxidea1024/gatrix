import { describe, it, expect } from 'vitest';
import { tokenize } from '../lexer';
import { resolveCursorContext } from '../cursor-context';
import {
  getSuggestions,
  applyCompletion,
  shouldKeepDropdownOpen,
} from '../suggestion-engine';
import { queryToChips } from '../useFilterChips';
import { LOGS_CONFIG } from '../fields';

const MOCK_FACETS = new Map<string, string[]>([
  ['level', ['debug', 'info', 'warn', 'error', 'warning', 'fatal']],
  ['environment', ['production', 'staging', 'development', 'local', 'test']],
  ['service', ['web', 'api', 'worker']],
]);

function pipeline(input: string, cursor?: number) {
  const c = cursor ?? input.length;
  const tokens = tokenize(input);
  const ctx = resolveCursorContext(input, c, tokens);
  const textBeforeCursor = input.slice(0, c);
  const chips = queryToChips(textBeforeCursor);
  const suggestions = getSuggestions(ctx, LOGS_CONFIG, MOCK_FACETS, 100, chips);
  return { tokens, ctx, suggestions };
}

describe('Chained autocomplete: empty → level → info', () => {
  it('Step 1: empty → select "level" field', () => {
    const { ctx, suggestions } = pipeline('', 0);
    const level = suggestions.find((s) => s.label === 'level');
    expect(level).toBeDefined();

    const result = applyCompletion('', ctx, level!);
    console.log('Step 1 result:', result);
    expect(result.text).toBe('level:');
    expect(result.cursorOffset).toBe(6);
  });

  it('Step 2: "level:" → select "info" value', () => {
    // Simulating state AFTER Step 1
    const { ctx, suggestions } = pipeline('level:', 6);
    console.log('Step 2 context:', JSON.stringify(ctx));
    console.log(
      'Step 2 suggestions:',
      suggestions.map((s) => `[${s.category}] ${s.label}`)
    );

    const info = suggestions.find((s) => s.label === 'info');
    expect(info).toBeDefined();

    const result = applyCompletion('level:', ctx, info!);
    console.log('Step 2 result:', result);
    expect(result.text).toBe('level:info');
    expect(result.cursorOffset).toBe(10);
  });

  it('Full chain: empty → level → info produces "level:info"', () => {
    // Step 1
    let { ctx, suggestions } = pipeline('', 0);
    const level = suggestions.find((s) => s.label === 'level')!;
    let result = applyCompletion('', ctx, level);

    // Step 2: re-compute context with new text
    ({ ctx, suggestions } = pipeline(result.text, result.cursorOffset));
    const info = suggestions.find((s) => s.label === 'info')!;
    result = applyCompletion(result.text, ctx, info);

    console.log('FINAL:', result);
    expect(result.text).toBe('level:info');
  });

  it('Full chain: empty → level → != → error', () => {
    let { ctx, suggestions } = pipeline('', 0);
    const level = suggestions.find((s) => s.label === 'level')!;
    let result = applyCompletion('', ctx, level);

    ({ ctx, suggestions } = pipeline(result.text, result.cursorOffset));
    const ne = suggestions.find((s) => s.label === '!=')!;
    result = applyCompletion(result.text, ctx, ne);

    ({ ctx, suggestions } = pipeline(result.text, result.cursorOffset));
    console.log('After !=:', result.text, 'context:', JSON.stringify(ctx));
    console.log(
      'After != suggestions:',
      suggestions.map((s) => `[${s.category}] ${s.label}`)
    );

    const error = suggestions.find((s) => s.label === 'error')!;
    result = applyCompletion(result.text, ctx, error);

    console.log('FINAL:', result);
    expect(result.text).toBe('level:!=error');
  });

  it('Full chain: level:info → and → message → contains', () => {
    let { ctx, suggestions } = pipeline('level:info', 10);

    // Space then logical
    ({ ctx, suggestions } = pipeline('level:info ', 11));
    const andItem = suggestions.find((s) => s.label === 'AND')!;
    let result = applyCompletion('level:info ', ctx, andItem);
    console.log('After and:', result);

    ({ ctx, suggestions } = pipeline(result.text, result.cursorOffset));
    const msg = suggestions.find((s) => s.label === 'message')!;
    result = applyCompletion(result.text, ctx, msg);
    console.log('After message:', result);
    expect(result.text).toBe('level:info AND message:');
  });

  it('Prioritization: exact match field "level" is sorted to the top (index 0)', () => {
    const { suggestions } = pipeline('level', 5);
    expect(suggestions[0]).toBeDefined();
    expect(suggestions[0].category).toBe('field');
    expect(suggestions[0].label).toBe('level');
  });

  it('Prioritization: operators are sorted to the bottom', () => {
    const { suggestions } = pipeline('level:', 6);
    const firstOpIdx = suggestions.findIndex((s) => s.category === 'operator');
    const lastValueIdx = suggestions
      .map((s) => s.category)
      .lastIndexOf('value');
    if (firstOpIdx !== -1 && lastValueIdx !== -1) {
      expect(firstOpIdx).toBeGreaterThan(lastValueIdx);
    }
  });

  it('All tab operator sorting: logic and parenthesis suggestions are placed at the bottom', () => {
    const { suggestions } = pipeline('', 0);

    const firstLogicIdx = suggestions.findIndex(
      (s) => s.fieldCategory === 'logic'
    );
    const lastDataFieldIdx = suggestions
      .map((s) => s.category === 'field' && s.fieldCategory !== 'logic')
      .lastIndexOf(true);

    if (firstLogicIdx !== -1 && lastDataFieldIdx !== -1) {
      expect(firstLogicIdx).toBeGreaterThan(lastDataFieldIdx);
    }

    // Verify relative ordering of operators is has -> not has -> (
    const labels = suggestions.map((s) => s.label);
    const hasIdx = labels.indexOf('has');
    const notHasIdx = labels.indexOf('not has');
    const openParenIdx = labels.indexOf('(');

    expect(hasIdx).toBeDefined();
    expect(notHasIdx).toBeDefined();
    expect(openParenIdx).toBeDefined();
    expect(hasIdx).toBeLessThan(notHasIdx);
    expect(notHasIdx).toBeLessThan(openParenIdx);
  });
});
