import { describe, it, expect } from 'vitest';
import { parse } from '../parser';
import { serializeForBackend } from '../serializer';

describe('Serializer', () => {
  const serialize = (input: string): string => {
    const { ast } = parse(input);
    return serializeForBackend(ast);
  };

  describe('simple filters', () => {
    it('should serialize field:value', () => {
      expect(serialize('country:KR')).toBe('country:KR');
    });

    it('should serialize field:!=value', () => {
      expect(serialize('country:!=CN')).toBe('country:!=CN');
    });

    it('should serialize comparison operators', () => {
      expect(serialize('level:>100')).toBe('level:>100');
      expect(serialize('level:>=100')).toBe('level:>=100');
      expect(serialize('level:<50')).toBe('level:<50');
      expect(serialize('level:<=50')).toBe('level:<=50');
    });

    it('should serialize quoted string', () => {
      expect(serialize('message:"hello world"')).toBe('message:"hello world"');
    });
  });

  describe('function operators', () => {
    it('should serialize contains', () => {
      expect(serialize('message:contains("timeout")')).toBe(
        'message.contains:"timeout"'
      );
    });

    it('should serialize startsWith', () => {
      expect(serialize('message:startsWith("net")')).toBe(
        'message.starts_with:"net"'
      );
    });

    it('should serialize endsWith', () => {
      expect(serialize('message:endsWith("error")')).toBe(
        'message.ends_with:"error"'
      );
    });

    it('should serialize before', () => {
      expect(serialize('timestamp:before("2025-01-01")')).toBe(
        'timestamp.before:"2025-01-01"'
      );
    });

    it('should serialize after with relative time', () => {
      expect(serialize('timestamp:after("now-1h")')).toBe(
        'timestamp.after:"now-1h"'
      );
    });
  });


  describe('logical operators', () => {
    it('should serialize AND', () => {
      expect(serialize('country:KR and level:error')).toBe(
        'country:KR AND level:error'
      );
    });

    it('should serialize OR', () => {
      expect(serialize('country:KR or country:JP')).toBe(
        'country:KR OR country:JP'
      );
    });

    it('should serialize NOT', () => {
      expect(serialize('not country:CN')).toBe('!country:CN');
    });

    it('should serialize BANG', () => {
      expect(serialize('!country:CN')).toBe('!country:CN');
    });
  });

  describe('grouping', () => {
    it('should serialize parenthesized group', () => {
      expect(serialize('(country:KR or country:JP) and level:error')).toBe(
        '(country:KR OR country:JP) AND level:error'
      );
    });
  });

  describe('free text', () => {
    it('should convert free text to message.contains', () => {
      expect(serialize('timeout')).toBe('message.contains:"timeout"');
    });

    it('should convert quoted free text', () => {
      expect(serialize('"network error"')).toBe(
        'message.contains:"network error"'
      );
    });
  });

  describe('empty input', () => {
    it('should return empty string for empty input', () => {
      expect(serialize('')).toBe('');
    });
  });

  describe('error handling', () => {
    it('should throw on partial expression', () => {
      // Construct a partial AST manually
      expect(() => {
        serializeForBackend({
          type: 'Partial',
          raw: 'broken',
          start: 0,
          end: 6,
        });
      }).toThrow();
    });
  });
});
