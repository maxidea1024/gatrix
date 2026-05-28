import { UrlBuilder, UrlSearchParams, isValidUrl } from '../src/url-builder';

describe('UrlSearchParams', () => {
  it('should parse a query string', () => {
    const params = new UrlSearchParams('foo=bar&baz=qux');
    expect(params.get('foo')).toBe('bar');
    expect(params.get('baz')).toBe('qux');
  });

  it('should handle leading ?', () => {
    const params = new UrlSearchParams('?foo=bar');
    expect(params.get('foo')).toBe('bar');
  });

  it('should handle empty string', () => {
    const params = new UrlSearchParams('');
    expect(params.toString()).toBe('');
  });

  it('should handle URL-encoded values', () => {
    const params = new UrlSearchParams('name=hello%20world&key=a%26b');
    expect(params.get('name')).toBe('hello world');
    expect(params.get('key')).toBe('a&b');
  });

  it('should set and get values', () => {
    const params = new UrlSearchParams();
    params.set('key', 'value');
    expect(params.get('key')).toBe('value');
  });

  it('should return null for non-existent keys', () => {
    const params = new UrlSearchParams();
    expect(params.get('missing')).toBeNull();
  });

  it('should delete keys', () => {
    const params = new UrlSearchParams('foo=bar');
    params.delete('foo');
    expect(params.get('foo')).toBeNull();
  });

  it('should check key existence with has', () => {
    const params = new UrlSearchParams('foo=bar');
    expect(params.has('foo')).toBe(true);
    expect(params.has('missing')).toBe(false);
  });

  it('should serialize to string with encoding', () => {
    const params = new UrlSearchParams();
    params.set('key', 'hello world');
    params.set('special', 'a&b=c');
    const result = params.toString();
    expect(result).toContain('key=hello%20world');
    expect(result).toContain('special=a%26b%3Dc');
  });
});

describe('UrlBuilder', () => {
  it('should parse a URL without query string', () => {
    const url = new UrlBuilder('https://api.example.com/api/v1');
    expect(url.toString()).toBe('https://api.example.com/api/v1');
  });

  it('should parse a URL with query string', () => {
    const url = new UrlBuilder('https://api.example.com/path?existing=value');
    expect(url.searchParams.get('existing')).toBe('value');
  });

  it('should add query parameters', () => {
    const url = new UrlBuilder('https://api.example.com/eval');
    url.searchParams.set('appName', 'myApp');
    url.searchParams.set('userId', '123');
    const result = url.toString();
    expect(result).toContain('appName=myApp');
    expect(result).toContain('userId=123');
    expect(result).toContain('?');
  });

  it('should preserve base URL when no params', () => {
    const url = new UrlBuilder('https://api.example.com/eval');
    expect(url.toString()).toBe('https://api.example.com/eval');
  });

  it('should handle URLs with brackets in param keys', () => {
    const url = new UrlBuilder('https://api.example.com/eval');
    url.searchParams.set('properties[platform]', 'ios');
    const result = url.toString();
    expect(result).toContain('properties%5Bplatform%5D=ios');
  });
});

describe('isValidUrl', () => {
  it('should accept valid HTTP URLs', () => {
    expect(isValidUrl('https://api.example.com')).toBe(true);
    expect(isValidUrl('http://localhost:3000')).toBe(true);
    expect(isValidUrl('https://api.example.com/api/v1')).toBe(true);
  });

  it('should accept valid WebSocket URLs', () => {
    expect(isValidUrl('ws://localhost:3000')).toBe(true);
    expect(isValidUrl('wss://api.example.com/ws')).toBe(true);
  });

  it('should reject invalid URLs', () => {
    expect(isValidUrl('')).toBe(false);
    expect(isValidUrl('not-a-url')).toBe(false);
    expect(isValidUrl('ftp://example.com')).toBe(false);
  });
});
