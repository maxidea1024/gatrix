import { FlagProxy } from '../src/FlagProxy';
import { EvaluatedFlag, VariationResult, Variant } from '../src/types';
import { VariationProvider } from '../src/VariationProvider';
import { FeaturesClient } from '../src/FeaturesClient';
import { EventEmitter } from '../src/EventEmitter';

// Mock ky module
jest.mock('ky', () => ({
  get: jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    headers: new Map(),
    json: () => Promise.resolve({ success: true, data: { flags: [] } }),
  }),
  post: jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
  }),
  __esModule: true,
  default: {
    get: jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Map(),
      json: () => Promise.resolve({ success: true, data: { flags: [] } }),
    }),
    post: jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
    }),
  },
}));

describe('FlagProxy', () => {
  // Test bootstrap data with various flag configurations
  const bootstrapFlags: EvaluatedFlag[] = [
    {
      name: 'enabled-flag',
      enabled: true,
      variant: { name: 'default', enabled: true, value: true },
      valueType: 'boolean',
      version: 1,
      reason: 'targeting_match',
    },
    {
      name: 'disabled-flag',
      enabled: false,
      variant: { name: 'disabled', enabled: false, value: false },
      valueType: 'boolean',
      version: 2,
      reason: 'disabled',
    },
    {
      name: 'string-flag',
      enabled: true,
      variant: { name: 'variantA', enabled: true, value: 'hello world' },
      valueType: 'string',
      version: 3,
      reason: 'percentage_rollout',
    },
    {
      name: 'number-flag',
      enabled: true,
      variant: { name: 'numVariant', enabled: true, value: 42.5 },
      valueType: 'number',
      version: 4,
      reason: 'evaluated',
    },
    {
      name: 'json-flag',
      enabled: true,
      variant: {
        name: 'jsonVariant',
        enabled: true,
        value: { key: 'value', nested: { a: 1 } },
      },
      valueType: 'json',
      version: 5,
      reason: 'evaluated',
      impressionData: true,
    },
    {
      name: 'invalid-number-flag',
      enabled: true,
      variant: { name: 'badNum', enabled: true, value: 'not-a-number' },
      valueType: 'number',
      version: 6,
    },
    {
      name: 'invalid-json-flag',
      enabled: true,
      variant: { name: 'badJson', enabled: true, value: 'not valid json' },
      valueType: 'json',
      version: 7,
    },
  ];

  let client: FeaturesClient;

  beforeAll(async () => {
    const emitter = new EventEmitter();
    client = new FeaturesClient(emitter, {
      apiUrl: 'https://api.example.com/api/v1',
      apiToken: 'test-token',
      appName: 'test-app',
      environment: 'test',
      features: {
        bootstrap: bootstrapFlags,
        disableRefresh: true,
      },
    });
    await client.init();
  });

  describe('undefined flag', () => {
    let proxy: FlagProxy;
    beforeAll(() => {
      proxy = client.getFlag('non-existent-flag');
    });

    it('should return flag name', () => {
      expect(proxy.name).toBe('non-existent-flag');
    });

    it('should report as not existing', () => {
      expect(proxy.exists).toBe(false);
    });

    it('should return false for enabled', () => {
      expect(proxy.enabled).toBe(false);
    });

    it('should return version 0', () => {
      expect(proxy.version).toBe(0);
    });

    it('should return default values for variations', () => {
      expect(proxy.boolVariation(true)).toBe(true);
      expect(proxy.stringVariation('default')).toBe('default');
      expect(proxy.numberVariation(100)).toBe(100);
      expect(proxy.jsonVariation({ default: true })).toEqual({ default: true });
    });
  });

  describe('enabled flag', () => {
    let proxy: FlagProxy;
    beforeAll(() => {
      proxy = client.getFlag('enabled-flag');
    });

    it('should return correct name', () => {
      expect(proxy.name).toBe('enabled-flag');
    });

    it('should report as existing', () => {
      expect(proxy.exists).toBe(true);
    });

    it('should return true for enabled', () => {
      expect(proxy.enabled).toBe(true);
    });

    it('should return true for boolVariation', () => {
      expect(proxy.boolVariation(false)).toBe(true);
    });

    it('should return raw flag', () => {
      expect(proxy.raw).toBeDefined();
      expect(proxy.raw?.name).toBe('enabled-flag');
    });
  });

  describe('disabled flag', () => {
    let proxy: FlagProxy;
    beforeAll(() => {
      proxy = client.getFlag('disabled-flag');
    });

    it('should return false for enabled', () => {
      expect(proxy.enabled).toBe(false);
    });

    it('should return false for boolVariation', () => {
      expect(proxy.boolVariation(true)).toBe(false);
    });
  });

  describe('string flag', () => {
    let proxy: FlagProxy;
    beforeAll(() => {
      proxy = client.getFlag('string-flag');
    });

    it('should return valueType as string', () => {
      expect(proxy.valueType).toBe('string');
    });

    it('should return correct string variation', () => {
      expect(proxy.stringVariation('default')).toBe('hello world');
    });
  });

  describe('number flag', () => {
    let proxy: FlagProxy;
    beforeAll(() => {
      proxy = client.getFlag('number-flag');
    });

    it('should return valueType as number', () => {
      expect(proxy.valueType).toBe('number');
    });

    it('should return correct number variation', () => {
      expect(proxy.numberVariation(0)).toBe(42.5);
    });
  });

  describe('json flag', () => {
    let proxy: FlagProxy;
    beforeAll(() => {
      proxy = client.getFlag('json-flag');
    });

    it('should return valueType as json', () => {
      expect(proxy.valueType).toBe('json');
    });

    it('should return correct json variation', () => {
      expect(proxy.jsonVariation({})).toEqual({
        key: 'value',
        nested: { a: 1 },
      });
    });

    it('should report impressionData', () => {
      expect(proxy.impressionData).toBe(true);
    });
  });

  describe('invalid number flag', () => {
    it('should return default value for invalid number', () => {
      const proxy = client.getFlag('invalid-number-flag');
      expect(proxy.numberVariation(999)).toBe(999);
    });
  });

  describe('invalid json flag', () => {
    it('should return default value for invalid json', () => {
      const proxy = client.getFlag('invalid-json-flag');
      expect(proxy.jsonVariation({ fallback: true })).toEqual({
        fallback: true,
      });
    });
  });

  describe('disabled flag variations', () => {
    let proxy: FlagProxy;
    beforeAll(() => {
      proxy = client.getFlag('disabled-flag');
    });

    it('should return default string for disabled flag', () => {
      expect(proxy.stringVariation('default')).toBe('default');
    });

    it('should return default number for disabled flag', () => {
      expect(proxy.numberVariation(0)).toBe(0);
    });

    it('should return default json for disabled flag', () => {
      expect(proxy.jsonVariation({})).toEqual({});
    });
  });

  describe('variationDetails', () => {
    describe('boolVariationDetails', () => {
      it('should return flag_not_found for non-existent flag', () => {
        const proxy = client.getFlag('non-existent');
        const result = proxy.boolVariationDetails(false);
        expect(result.reason).toBe('flag_not_found');
        expect(result.flagExists).toBe(false);
        expect(result.value).toBe(false);
      });

      it('should return correct details for enabled flag', () => {
        const proxy = client.getFlag('enabled-flag');
        const result = proxy.boolVariationDetails(false);
        expect(result.value).toBe(true);
        expect(result.reason).toBe('targeting_match');
        expect(result.flagExists).toBe(true);
        expect(result.enabled).toBe(true);
      });

      it('should return correct details for disabled flag', () => {
        const proxy = client.getFlag('disabled-flag');
        const result = proxy.boolVariationDetails(false);
        expect(result.value).toBe(false);
        expect(result.reason).toBe('disabled');
        expect(result.flagExists).toBe(true);
        expect(result.enabled).toBe(false);
      });
    });

    describe('stringVariationDetails', () => {
      it('should return correct details for string flag', () => {
        const proxy = client.getFlag('string-flag');
        const result = proxy.stringVariationDetails('');
        expect(result.value).toBe('hello world');
        expect(result.reason).toBe('percentage_rollout');
        expect(result.flagExists).toBe(true);
        expect(result.enabled).toBe(true);
      });
    });

    describe('numberVariationDetails', () => {
      it('should return correct value for valid number', () => {
        const proxy = client.getFlag('number-flag');
        const result = proxy.numberVariationDetails(0);
        expect(result.value).toBe(42.5);
        expect(result.reason).toBe('evaluated');
      });
    });

    describe('jsonVariationDetails', () => {
      it('should return correct value for valid json', () => {
        const proxy = client.getFlag('json-flag');
        const result = proxy.jsonVariationDetails({});
        expect(result.value).toEqual({ key: 'value', nested: { a: 1 } });
        expect(result.reason).toBe('evaluated');
      });
    });
  });

  describe('variationOrThrow', () => {
    describe('boolVariationOrThrow', () => {
      it('should throw for non-existent flag', () => {
        const proxy = client.getFlag('non-existent');
        expect(() => proxy.boolVariationOrThrow()).toThrow('not found');
      });

      it('should return value for existing flag', () => {
        const proxy = client.getFlag('enabled-flag');
        expect(proxy.boolVariationOrThrow()).toBe(true);
      });
    });

    describe('stringVariationOrThrow', () => {
      it('should throw for non-existent flag', () => {
        const proxy = client.getFlag('non-existent');
        expect(() => proxy.stringVariationOrThrow()).toThrow('not found');
      });

      it('should return value for valid string flag', () => {
        const proxy = client.getFlag('string-flag');
        expect(proxy.stringVariationOrThrow()).toBe('hello world');
      });
    });

    describe('numberVariationOrThrow', () => {
      it('should throw for invalid number', () => {
        const proxy = client.getFlag('invalid-number-flag');
        expect(() => proxy.numberVariationOrThrow()).toThrow();
      });

      it('should return value for valid number', () => {
        const proxy = client.getFlag('number-flag');
        expect(proxy.numberVariationOrThrow()).toBe(42.5);
      });
    });

    describe('jsonVariationOrThrow', () => {
      it('should throw for invalid json', () => {
        const proxy = client.getFlag('invalid-json-flag');
        expect(() => proxy.jsonVariationOrThrow()).toThrow();
      });

      it('should return value for valid json', () => {
        const proxy = client.getFlag('json-flag');
        expect(proxy.jsonVariationOrThrow()).toEqual({
          key: 'value',
          nested: { a: 1 },
        });
      });
    });
  });

  describe('reason getter', () => {
    it('should return undefined for non-existent flag', () => {
      const proxy = client.getFlag('non-existent');
      expect(proxy.reason).toBeUndefined();
    });

    it('should return reason from flag', () => {
      const proxy = client.getFlag('enabled-flag');
      expect(proxy.reason).toBe('targeting_match');
    });
  });
});
