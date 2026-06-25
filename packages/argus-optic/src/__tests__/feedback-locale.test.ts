import { describe, it, expect } from 'vitest';
import { parseSearchToSQL } from '../query-builder';

describe('parseSearchToSQL – feedback locale filter', () => {
  it('should generate correct SQL for locale:zh-TW', () => {
    const params: Record<string, any> = {};
    const result = parseSearchToSQL('feedback', 'locale:zh-TW', params);
    console.log('WHERE:', result.where);
    console.log('PARAMS:', params);
    expect(result.where).toBeTruthy();
    // Should produce: locale = 'zh-TW' (not split by hyphen)
    expect(result.where).toContain('locale');
    expect(result.where).not.toContain("'zh'"); // should NOT split
  });

  it('should generate correct SQL for locale:"fr-FR"', () => {
    const params: Record<string, any> = {};
    const result = parseSearchToSQL('feedback', 'locale:"fr-FR"', params);
    console.log('WHERE:', result.where);
    console.log('PARAMS:', params);
    expect(result.where).toBeTruthy();
    expect(result.where).toContain('locale');
  });

  it('should generate correct SQL for locale:en', () => {
    const params: Record<string, any> = {};
    const result = parseSearchToSQL('feedback', 'locale:en', params);
    console.log('WHERE:', result.where);
    console.log('PARAMS:', params);
    expect(result.where).toBeTruthy();
    expect(result.where).toContain('locale');
  });

  it('should generate correct SQL for platform:PlayStation', () => {
    const params: Record<string, any> = {};
    const result = parseSearchToSQL('feedback', 'platform:PlayStation', params);
    console.log('WHERE:', result.where);
    console.log('PARAMS:', params);
    expect(result.where).toBeTruthy();
  });

  it('should generate correct SQL for category:bug', () => {
    const params: Record<string, any> = {};
    const result = parseSearchToSQL('feedback', 'category:bug', params);
    console.log('WHERE:', result.where);
    console.log('PARAMS:', params);
    expect(result.where).toBeTruthy();
    expect(result.where).toContain('category');
  });
});
