import { FlagProxy } from '../src/FlagProxy';
import { EvaluatedFlag } from '../src/types';

describe('FlagProxy', () => {
    // Test bootstrap data with various flag configurations
    const bootstrapFlags: EvaluatedFlag[] = [
        {
            name: 'enabled-flag',
            enabled: true,
            variant: { name: 'default', enabled: true },
            variantType: 'none',
            version: 1,
            reason: 'targeting_match',
        },
        {
            name: 'disabled-flag',
            enabled: false,
            variant: { name: 'disabled', enabled: false },
            variantType: 'none',
            version: 2,
            reason: 'disabled',
        },
        {
            name: 'string-flag',
            enabled: true,
            variant: { name: 'variantA', enabled: true, payload: 'hello world' },
            variantType: 'string',
            version: 3,
            reason: 'percentage_rollout',
        },
        {
            name: 'number-flag',
            enabled: true,
            variant: { name: 'numVariant', enabled: true, payload: '42.5' },
            variantType: 'number',
            version: 4,
            reason: 'evaluated',
        },
        {
            name: 'json-flag',
            enabled: true,
            variant: { name: 'jsonVariant', enabled: true, payload: '{"key":"value","nested":{"a":1}}' },
            variantType: 'json',
            version: 5,
            reason: 'evaluated',
            impressionData: true,
        },
        {
            name: 'invalid-number-flag',
            enabled: true,
            variant: { name: 'badNum', enabled: true, payload: 'not-a-number' },
            variantType: 'number',
            version: 6,
        },
        {
            name: 'invalid-json-flag',
            enabled: true,
            variant: { name: 'badJson', enabled: true, payload: 'not valid json' },
            variantType: 'json',
            version: 7,
        },
    ];

    describe('undefined flag', () => {
        const proxy = new FlagProxy(undefined);

        it('should return empty name', () => {
            expect(proxy.name).toBe('');
        });

        it('should report as not existing', () => {
            expect(proxy.exists).toBe(false);
        });

        it('should return false for enabled', () => {
            expect(proxy.enabled).toBe(false);
        });

        it('should return false for isEnabled()', () => {
            expect(proxy.isEnabled()).toBe(false);
        });

        it('should return default variant', () => {
            expect(proxy.variant.name).toBe('disabled');
            expect(proxy.variant.enabled).toBe(false);
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
        const flag = bootstrapFlags.find((f) => f.name === 'enabled-flag')!;
        const proxy = new FlagProxy(flag);

        it('should return correct name', () => {
            expect(proxy.name).toBe('enabled-flag');
        });

        it('should report as existing', () => {
            expect(proxy.exists).toBe(true);
        });

        it('should return true for enabled', () => {
            expect(proxy.enabled).toBe(true);
        });

        it('should return true for isEnabled()', () => {
            expect(proxy.isEnabled()).toBe(true);
        });

        it('should return true for boolVariation', () => {
            expect(proxy.boolVariation(false)).toBe(true);
        });

        it('should return raw flag', () => {
            expect(proxy.raw).toBe(flag);
        });
    });

    describe('disabled flag', () => {
        const flag = bootstrapFlags.find((f) => f.name === 'disabled-flag')!;
        const proxy = new FlagProxy(flag);

        it('should return false for enabled', () => {
            expect(proxy.enabled).toBe(false);
        });

        it('should return false for boolVariation', () => {
            expect(proxy.boolVariation(true)).toBe(false);
        });
    });

    describe('string flag', () => {
        const flag = bootstrapFlags.find((f) => f.name === 'string-flag')!;
        const proxy = new FlagProxy(flag);

        it('should return variantType as string', () => {
            expect(proxy.variantType).toBe('string');
        });

        it('should return correct string variation', () => {
            expect(proxy.stringVariation('default')).toBe('hello world');
        });

        it('should return variant name', () => {
            expect(proxy.getVariantName()).toBe('variantA');
        });
    });

    describe('number flag', () => {
        const flag = bootstrapFlags.find((f) => f.name === 'number-flag')!;
        const proxy = new FlagProxy(flag);

        it('should return variantType as number', () => {
            expect(proxy.variantType).toBe('number');
        });

        it('should return correct number variation', () => {
            expect(proxy.numberVariation(0)).toBe(42.5);
        });

        it('should handle integer numbers', () => {
            const intFlag: EvaluatedFlag = {
                ...flag,
                variant: { name: 'int', enabled: true, payload: '100' },
            };
            const intProxy = new FlagProxy(intFlag);
            expect(intProxy.numberVariation(0)).toBe(100);
        });
    });

    describe('json flag', () => {
        const flag = bootstrapFlags.find((f) => f.name === 'json-flag')!;
        const proxy = new FlagProxy(flag);

        it('should return variantType as json', () => {
            expect(proxy.variantType).toBe('json');
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
        const flag = bootstrapFlags.find((f) => f.name === 'invalid-number-flag')!;
        const proxy = new FlagProxy(flag);

        it('should return default value for invalid number', () => {
            expect(proxy.numberVariation(999)).toBe(999);
        });
    });

    describe('invalid json flag', () => {
        const flag = bootstrapFlags.find((f) => f.name === 'invalid-json-flag')!;
        const proxy = new FlagProxy(flag);

        it('should return default value for invalid json', () => {
            expect(proxy.jsonVariation({ fallback: true })).toEqual({ fallback: true });
        });
    });

    describe('disabled flag variations', () => {
        const flag = bootstrapFlags.find((f) => f.name === 'disabled-flag')!;
        const proxy = new FlagProxy(flag);

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
});
