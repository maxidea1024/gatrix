import { FlagProxy } from '../src/flag-proxy';
import { VariationProvider } from '../src/variation-provider';
import {
  EvaluatedFlag,
  Variant,
  ValueType,
  VariationResult,
} from '../src/types';

function createMockProvider(
  flags: Map<string, EvaluatedFlag>
): VariationProvider {
  const lookup = (name: string) => flags.get(name);

  return {
    isEnabledInternal: jest.fn(
      (name: string) => lookup(name)?.enabled ?? false
    ),
    getVariantInternal: jest.fn(
      (name: string) =>
        lookup(name)?.variant ?? { name: '$missing', enabled: false }
    ),
    hasFlagInternal: jest.fn((name: string) => flags.has(name)),
    getValueTypeInternal: jest.fn(
      (name: string) => lookup(name)?.valueType ?? 'none'
    ),
    getVersionInternal: jest.fn((name: string) => lookup(name)?.version ?? 0),
    getReasonInternal: jest.fn((name: string) => lookup(name)?.reason),
    getImpressionDataInternal: jest.fn(
      (name: string) => lookup(name)?.impressionData ?? false
    ),
    getRawFlagInternal: jest.fn((name: string) => lookup(name)),

    variationInternal: jest.fn(
      (name: string, fb: string) => lookup(name)?.variant.name ?? fb
    ),
    boolVariationInternal: jest.fn((name: string, fb: boolean) => {
      const f = lookup(name);
      if (!f || f.valueType !== 'boolean') return fb;
      return Boolean(f.variant.value);
    }),
    stringVariationInternal: jest.fn((name: string, fb: string) => {
      const f = lookup(name);
      if (!f || f.valueType !== 'string') return fb;
      return String(f.variant.value);
    }),
    numberVariationInternal: jest.fn((name: string, fb: number) => {
      const f = lookup(name);
      if (!f || f.valueType !== 'number') return fb;
      return Number(f.variant.value);
    }),
    jsonVariationInternal: jest.fn((name: string, fb: any) => {
      const f = lookup(name);
      if (!f || f.valueType !== 'json') return fb;
      return f.variant.value;
    }),

    boolVariationDetailsInternal: jest.fn((name: string, fb: boolean) => ({
      value: fb,
      reason: 'test',
      flagExists: flags.has(name),
      enabled: false,
    })),
    stringVariationDetailsInternal: jest.fn((name: string, fb: string) => ({
      value: fb,
      reason: 'test',
      flagExists: flags.has(name),
      enabled: false,
    })),
    numberVariationDetailsInternal: jest.fn((name: string, fb: number) => ({
      value: fb,
      reason: 'test',
      flagExists: flags.has(name),
      enabled: false,
    })),
    jsonVariationDetailsInternal: jest.fn((name: string, fb: any) => ({
      value: fb,
      reason: 'test',
      flagExists: flags.has(name),
      enabled: false,
    })),

    boolVariationOrThrowInternal: jest.fn((name: string) => {
      const f = lookup(name);
      if (!f) throw new Error('not found');
      return Boolean(f.variant.value);
    }),
    stringVariationOrThrowInternal: jest.fn((name: string) => {
      const f = lookup(name);
      if (!f) throw new Error('not found');
      return String(f.variant.value);
    }),
    numberVariationOrThrowInternal: jest.fn((name: string) => {
      const f = lookup(name);
      if (!f) throw new Error('not found');
      return Number(f.variant.value);
    }),
    jsonVariationOrThrowInternal: jest.fn((name: string) => {
      const f = lookup(name);
      if (!f) throw new Error('not found');
      return f.variant.value;
    }) as any,
  };
}

const testFlag: EvaluatedFlag = {
  id: 'flag-1',
  name: 'test-flag',
  enabled: true,
  variant: { name: 'variant-a', enabled: true, value: 'hello' },
  valueType: 'string',
  version: 3,
  reason: 'targeting',
  impressionData: true,
};

const boolFlag: EvaluatedFlag = {
  id: 'flag-2',
  name: 'bool-flag',
  enabled: true,
  variant: { name: 'enabled', enabled: true, value: true },
  valueType: 'boolean',
  version: 1,
};

describe('FlagProxy', () => {
  let flags: Map<string, EvaluatedFlag>;
  let provider: VariationProvider;

  beforeEach(() => {
    flags = new Map();
    flags.set('test-flag', testFlag);
    flags.set('bool-flag', boolFlag);
    provider = createMockProvider(flags);
  });

  describe('properties', () => {
    it('should return the flag name', () => {
      const proxy = new FlagProxy(provider, 'test-flag');
      expect(proxy.name).toBe('test-flag');
    });

    it('should return isRealtime', () => {
      const rt = new FlagProxy(provider, 'test-flag', true);
      expect(rt.isRealtime).toBe(true);

      const synced = new FlagProxy(provider, 'test-flag', false);
      expect(synced.isRealtime).toBe(false);
    });

    it('should delegate exists to provider', () => {
      const proxy = new FlagProxy(provider, 'test-flag');
      expect(proxy.exists).toBe(true);
      expect(provider.hasFlagInternal).toHaveBeenCalledWith('test-flag', true);
    });

    it('should delegate enabled to provider', () => {
      const proxy = new FlagProxy(provider, 'test-flag');
      expect(proxy.enabled).toBe(true);
      expect(provider.isEnabledInternal).toHaveBeenCalledWith(
        'test-flag',
        true
      );
    });

    it('should delegate variant to provider', () => {
      const proxy = new FlagProxy(provider, 'test-flag');
      const variant = proxy.variant;
      expect(provider.getVariantInternal).toHaveBeenCalledWith(
        'test-flag',
        true
      );
    });

    it('should delegate valueType to provider', () => {
      const proxy = new FlagProxy(provider, 'test-flag');
      expect(proxy.valueType).toBe('string');
    });

    it('should delegate version to provider', () => {
      const proxy = new FlagProxy(provider, 'test-flag');
      expect(proxy.version).toBe(3);
    });

    it('should return false for non-existent flags', () => {
      const proxy = new FlagProxy(provider, 'nonexistent');
      expect(proxy.exists).toBe(false);
      expect(proxy.enabled).toBe(false);
    });
  });

  describe('variation methods', () => {
    it('should delegate variation', () => {
      const proxy = new FlagProxy(provider, 'test-flag');
      proxy.variation('fallback');
      expect(provider.variationInternal).toHaveBeenCalledWith(
        'test-flag',
        'fallback',
        true
      );
    });

    it('should delegate boolVariation', () => {
      const proxy = new FlagProxy(provider, 'bool-flag');
      const result = proxy.boolVariation(false);
      expect(provider.boolVariationInternal).toHaveBeenCalledWith(
        'bool-flag',
        false,
        true
      );
      expect(result).toBe(true);
    });

    it('should delegate stringVariation', () => {
      const proxy = new FlagProxy(provider, 'test-flag');
      const result = proxy.stringVariation('default');
      expect(provider.stringVariationInternal).toHaveBeenCalledWith(
        'test-flag',
        'default',
        true
      );
      expect(result).toBe('hello');
    });

    it('should delegate numberVariation', () => {
      const proxy = new FlagProxy(provider, 'test-flag');
      proxy.numberVariation(0);
      expect(provider.numberVariationInternal).toHaveBeenCalledWith(
        'test-flag',
        0,
        true
      );
    });

    it('should delegate jsonVariation', () => {
      const proxy = new FlagProxy(provider, 'test-flag');
      proxy.jsonVariation({});
      expect(provider.jsonVariationInternal).toHaveBeenCalledWith(
        'test-flag',
        {},
        true
      );
    });
  });

  describe('strict variation (OrThrow)', () => {
    it('should delegate boolVariationOrThrow', () => {
      const proxy = new FlagProxy(provider, 'bool-flag');
      proxy.boolVariationOrThrow();
      expect(provider.boolVariationOrThrowInternal).toHaveBeenCalledWith(
        'bool-flag',
        true
      );
    });

    it('should throw for non-existent flags', () => {
      const proxy = new FlagProxy(provider, 'nonexistent');
      expect(() => proxy.boolVariationOrThrow()).toThrow();
    });
  });
});
