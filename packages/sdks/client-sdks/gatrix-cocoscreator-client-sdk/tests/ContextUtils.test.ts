import { truncateToMinute, buildContextQueryParams, SYSTEM_CONTEXT_FIELDS } from '../src/context-utils';
import { UrlBuilder } from '../src/url-builder';
import { GatrixContext } from '../src/types';

describe('truncateToMinute', () => {
  it('should truncate seconds and milliseconds', () => {
    const result = truncateToMinute('2025-01-15T10:30:45.123Z');
    expect(result).toBe('2025-01-15T10:30:00.000Z');
  });

  it('should return unchanged if already truncated', () => {
    const result = truncateToMinute('2025-01-15T10:30:00.000Z');
    expect(result).toBe('2025-01-15T10:30:00.000Z');
  });

  it('should return original string for invalid date', () => {
    const result = truncateToMinute('not-a-date');
    expect(result).toBe('not-a-date');
  });
});

describe('buildContextQueryParams', () => {
  it('should add top-level context fields as query params', () => {
    const url = new UrlBuilder('https://api.example.com/eval');
    const context: GatrixContext = {
      appName: 'myApp',
      userId: 'user123',
      sessionId: 'session456',
    };
    buildContextQueryParams(url, context);
    const result = url.toString();
    expect(result).toContain('appName=myApp');
    expect(result).toContain('userId=user123');
    expect(result).toContain('sessionId=session456');
  });

  it('should add properties with bracket notation', () => {
    const url = new UrlBuilder('https://api.example.com/eval');
    const context: GatrixContext = {
      appName: 'myApp',
      properties: { platform: 'ios', version: '1.0' },
    };
    buildContextQueryParams(url, context);
    const result = url.toString();
    expect(result).toContain('properties%5Bplatform%5D=ios');
    expect(result).toContain('properties%5Bversion%5D=1.0');
  });

  it('should skip null/undefined values', () => {
    const url = new UrlBuilder('https://api.example.com/eval');
    const context: GatrixContext = {
      appName: 'myApp',
      userId: undefined,
    };
    buildContextQueryParams(url, context);
    const result = url.toString();
    expect(result).toContain('appName=myApp');
    expect(result).not.toContain('userId');
  });

  it('should truncate currentTime to minute', () => {
    const url = new UrlBuilder('https://api.example.com/eval');
    const context: GatrixContext = {
      appName: 'myApp',
      currentTime: '2025-01-15T10:30:45.123Z',
    };
    buildContextQueryParams(url, context);
    const result = url.toString();
    expect(result).toContain('currentTime=2025-01-15T10%3A30%3A00.000Z');
  });
});

describe('SYSTEM_CONTEXT_FIELDS', () => {
  it('should contain appName', () => {
    expect(SYSTEM_CONTEXT_FIELDS.has('appName')).toBe(true);
  });

  it('should not contain userId', () => {
    expect(SYSTEM_CONTEXT_FIELDS.has('userId')).toBe(false);
  });
});
