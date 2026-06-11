import { tokenize } from '../lexer';
import { resolveCursorContext } from '../cursor-context';
import { getSuggestions } from '../suggestion-engine';
import { DISCOVER_CONFIG } from '../fields';
import { describe, it, expect } from 'vitest';

describe('Aggregate arg → operator flow', () => {
  it('after selecting field in aggregate arg, should show operator context', () => {
    // After selecting platform in uniq(, the text becomes uniq(platform):
    const input = 'uniq(platform):';
    const tokens = tokenize(input);
    const ctx = resolveCursorContext(input, input.length, tokens);
    console.log('Context:', JSON.stringify(ctx));
    expect(ctx.type).toBe('OPERATOR');
    expect(ctx.field).toBe('uniq');
  });

  it('should suggest comparison operators for uniq(platform):', () => {
    const input = 'uniq(platform):';
    const tokens = tokenize(input);
    const ctx = resolveCursorContext(input, input.length, tokens);
    const suggestions = getSuggestions(ctx, DISCOVER_CONFIG);
    console.log('Suggestions:', suggestions.map(s => `${s.label} (${s.category})`));
    const opSugs = suggestions.filter(s => s.category === 'operator');
    expect(opSugs.some(s => s.label === '>')).toBe(true);
    expect(opSugs.some(s => s.label === '>=')).toBe(true);
  });
});
