import { uuidv4, deepClone, contextString, djb2Hash, computeContextHash, computeEtag, isEqualFlag } from '../src/utils';
import { EvaluatedFlag } from '../src/types';

describe('uuidv4', () => {
  it('should generate a valid v4 UUID format', () => {
    const uuid = uuidv4();
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('should generate unique values', () => {
    const uuids = new Set(Array.from({ length: 100 }, () => uuidv4()));
    expect(uuids.size).toBe(100);
  });
});

describe('deepClone', () => {
  it('should clone simple objects', () => {
    const original = { a: 1, b: 'test' };
    const cloned = deepClone(original);
    expect(cloned).toEqual(original);
    expect(cloned).not.toBe(original);
  });

  it('should clone nested objects', () => {
    const original = { a: { b: { c: 3 } } };
    const cloned = deepClone(original);
    expect(cloned).toEqual(original);
    cloned.a.b.c = 999;
    expect(original.a.b.c).toBe(3);
  });

  it('should clone arrays', () => {
    const original = [1, [2, 3], { a: 4 }];
    const cloned = deepClone(original);
    expect(cloned).toEqual(original);
    expect(cloned).not.toBe(original);
  });

  it('should handle null and primitives', () => {
    expect(deepClone(null)).toBe(null);
    expect(deepClone(42)).toBe(42);
    expect(deepClone('hello')).toBe('hello');
    expect(deepClone(true)).toBe(true);
  });
});

describe('djb2Hash', () => {
  it('should return a consistent hash for the same input', () => {
    const hash1 = djb2Hash('hello world');
    const hash2 = djb2Hash('hello world');
    expect(hash1).toBe(hash2);
  });

  it('should return different hashes for different inputs', () => {
    const hash1 = djb2Hash('hello');
    const hash2 = djb2Hash('world');
    expect(hash1).not.toBe(hash2);
  });

  it('should return an 8-character hex string', () => {
    const hash = djb2Hash('test');
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
  });

  it('should handle empty string', () => {
    const hash = djb2Hash('');
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe('contextString', () => {
  it('should produce deterministic output regardless of key order', () => {
    const a = contextString({ userId: '1', appName: 'app' });
    const b = contextString({ appName: 'app', userId: '1' });
    expect(a).toBe(b);
  });

  it('should include properties', () => {
    const result = contextString({ userId: '1', properties: { platform: 'ios' } });
    expect(result).toContain('platform');
    expect(result).toContain('ios');
  });
});

describe('computeContextHash', () => {
  it('should return deterministic hash for same context', () => {
    const context = { userId: 'user1', appName: 'testApp' };
    const hash1 = computeContextHash(context);
    const hash2 = computeContextHash(context);
    expect(hash1).toBe(hash2);
  });

  it('should return different hash for different context', () => {
    const hash1 = computeContextHash({ userId: 'user1' });
    const hash2 = computeContextHash({ userId: 'user2' });
    expect(hash1).not.toBe(hash2);
  });
});

describe('computeEtag', () => {
  const baseFlag: EvaluatedFlag = {
    id: 'flag-1',
    name: 'test-flag',
    enabled: true,
    variant: { name: 'variant-a', enabled: true, value: 'hello' },
    valueType: 'string',
    version: 1,
  };

  it('should return a quoted string', () => {
    const etag = computeEtag([baseFlag], 'ctx-hash');
    expect(etag).toMatch(/^"[0-9a-f]+"$/);
  });

  it('should return deterministic etag for same input', () => {
    const etag1 = computeEtag([baseFlag], 'ctx-hash');
    const etag2 = computeEtag([baseFlag], 'ctx-hash');
    expect(etag1).toBe(etag2);
  });

  it('should return different etag for different flags', () => {
    const flag2: EvaluatedFlag = { ...baseFlag, name: 'other-flag' };
    const etag1 = computeEtag([baseFlag], 'ctx');
    const etag2 = computeEtag([flag2], 'ctx');
    expect(etag1).not.toBe(etag2);
  });

  it('should be order-independent (sorted by name)', () => {
    const flag2: EvaluatedFlag = { ...baseFlag, name: 'aaa-flag' };
    const etag1 = computeEtag([baseFlag, flag2], 'ctx');
    const etag2 = computeEtag([flag2, baseFlag], 'ctx');
    expect(etag1).toBe(etag2);
  });
});

describe('isEqualFlag', () => {
  const makeFlag = (overrides: Partial<EvaluatedFlag> = {}): EvaluatedFlag => ({
    id: 'f1',
    name: 'test',
    enabled: true,
    variant: { name: 'v1', enabled: true, value: 'hello' },
    valueType: 'string',
    version: 1,
    ...overrides,
  });

  it('should return true for identical flags with same context/version', () => {
    const a = makeFlag();
    const b = makeFlag();
    expect(isEqualFlag(a, b, 'ctx1', 'ctx1')).toBe(true);
  });

  it('should return false when enabled differs', () => {
    const a = makeFlag({ enabled: true });
    const b = makeFlag({ enabled: false });
    expect(isEqualFlag(a, b)).toBe(false);
  });

  it('should return false when variant name differs', () => {
    const a = makeFlag();
    const b = makeFlag({ variant: { name: 'v2', enabled: true, value: 'hello' } });
    expect(isEqualFlag(a, b)).toBe(false);
  });

  it('should return false when variant value differs', () => {
    const a = makeFlag();
    const b = makeFlag({ variant: { name: 'v1', enabled: true, value: 'world' } });
    expect(isEqualFlag(a, b)).toBe(false);
  });

  it('should use JSON compare for json valueType', () => {
    const a = makeFlag({ valueType: 'json', variant: { name: 'v1', enabled: true, value: { key: 'val' } } });
    const b = makeFlag({ valueType: 'json', variant: { name: 'v1', enabled: true, value: { key: 'val' } } });
    expect(isEqualFlag(a, b)).toBe(true);
  });

  it('should handle null/undefined inputs', () => {
    expect(isEqualFlag(null, null)).toBe(true);
    expect(isEqualFlag(makeFlag(), null)).toBe(false);
    expect(isEqualFlag(null, makeFlag())).toBe(false);
  });
});
