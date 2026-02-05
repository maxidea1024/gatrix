import { FeaturesClient } from '../src/FeaturesClient';
import { EventEmitter } from '../src/EventEmitter';
import { EvaluatedFlag, GatrixClientConfig } from '../src/types';
import { EVENTS } from '../src/events';

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Bootstrap data with various flag configurations
const bootstrapFlags: EvaluatedFlag[] = [
    {
        name: 'bool-enabled',
        enabled: true,
        variant: { name: 'default', enabled: true },
        variantType: 'none',
        version: 1,
        reason: 'targeting_match',
    },
    {
        name: 'bool-disabled',
        enabled: false,
        variant: { name: 'disabled', enabled: false },
        variantType: 'none',
        version: 2,
        reason: 'disabled',
    },
    {
        name: 'string-variant',
        enabled: true,
        variant: { name: 'variantA', enabled: true, payload: 'hello world' },
        variantType: 'string',
        version: 3,
        reason: 'percentage_rollout',
    },
    {
        name: 'number-variant',
        enabled: true,
        variant: { name: 'numVariant', enabled: true, payload: '42.5' },
        variantType: 'number',
        version: 4,
        reason: 'evaluated',
    },
    {
        name: 'json-variant',
        enabled: true,
        variant: {
            name: 'jsonVariant',
            enabled: true,
            payload: '{"key":"value","nested":{"a":1}}',
        },
        variantType: 'json',
        version: 5,
        reason: 'evaluated',
        impressionData: true,
    },
    {
        name: 'invalid-number',
        enabled: true,
        variant: { name: 'badNum', enabled: true, payload: 'not-a-number' },
        variantType: 'number',
        version: 6,
    },
    {
        name: 'invalid-json',
        enabled: true,
        variant: { name: 'badJson', enabled: true, payload: 'not valid json' },
        variantType: 'json',
        version: 7,
    },
    {
        name: 'disabled-with-payload',
        enabled: false,
        variant: { name: 'disabled', enabled: false, payload: 'ignored' },
        variantType: 'string',
        version: 8,
        reason: 'disabled',
    },
];

describe('FeaturesClient', () => {
    let emitter: EventEmitter;
    let client: FeaturesClient;
    const defaultConfig: GatrixClientConfig = {
        url: 'https://api.example.com/api/v1/client/features/test/eval',
        apiKey: 'test-api-key',
        appName: 'test-app',
        features: {
            bootstrap: bootstrapFlags,
            disableRefresh: true, // Disable polling for tests
        },
    };

    beforeEach(() => {
        emitter = new EventEmitter();
        client = new FeaturesClient(emitter, defaultConfig);
        mockFetch.mockReset();
    });

    describe('initialization with bootstrap', () => {
        it('should be ready immediately with bootstrap data', async () => {
            await client.init();

            expect(client.isReady()).toBe(true);
        });

        it('should emit READY event', async () => {
            const readyCallback = jest.fn();
            emitter.on(EVENTS.READY, readyCallback);

            await client.init();

            expect(readyCallback).toHaveBeenCalled();
        });

        it('should have all bootstrap flags', async () => {
            await client.init();

            const allFlags = client.getAllFlags();
            expect(allFlags.length).toBe(bootstrapFlags.length);
        });
    });

    describe('isEnabled', () => {
        beforeEach(async () => {
            await client.init();
        });

        it('should return true for enabled flag', () => {
            expect(client.isEnabled('bool-enabled')).toBe(true);
        });

        it('should return false for disabled flag', () => {
            expect(client.isEnabled('bool-disabled')).toBe(false);
        });

        it('should return false for non-existent flag', () => {
            expect(client.isEnabled('non-existent')).toBe(false);
        });
    });

    describe('boolVariation', () => {
        beforeEach(async () => {
            await client.init();
        });

        it('should return true for enabled flag', () => {
            expect(client.boolVariation('bool-enabled', false)).toBe(true);
        });

        it('should return false for disabled flag', () => {
            expect(client.boolVariation('bool-disabled', true)).toBe(false);
        });

        it('should return default for non-existent flag', () => {
            expect(client.boolVariation('non-existent', true)).toBe(true);
            expect(client.boolVariation('non-existent', false)).toBe(false);
        });
    });

    describe('stringVariation', () => {
        beforeEach(async () => {
            await client.init();
        });

        it('should return payload for enabled string flag', () => {
            expect(client.stringVariation('string-variant', 'default')).toBe('hello world');
        });

        it('should return default for disabled flag', () => {
            expect(client.stringVariation('disabled-with-payload', 'default')).toBe('default');
        });

        it('should return default for non-existent flag', () => {
            expect(client.stringVariation('non-existent', 'default')).toBe('default');
        });
    });

    describe('numberVariation', () => {
        beforeEach(async () => {
            await client.init();
        });

        it('should return parsed number for number flag', () => {
            expect(client.numberVariation('number-variant', 0)).toBe(42.5);
        });

        it('should return default for invalid number', () => {
            expect(client.numberVariation('invalid-number', 999)).toBe(999);
        });

        it('should return default for non-existent flag', () => {
            expect(client.numberVariation('non-existent', 100)).toBe(100);
        });
    });

    describe('jsonVariation', () => {
        beforeEach(async () => {
            await client.init();
        });

        it('should return parsed JSON for json flag', () => {
            expect(client.jsonVariation('json-variant', {})).toEqual({
                key: 'value',
                nested: { a: 1 },
            });
        });

        it('should return default for invalid json', () => {
            expect(client.jsonVariation('invalid-json', { fallback: true })).toEqual({
                fallback: true,
            });
        });

        it('should return default for non-existent flag', () => {
            expect(client.jsonVariation('non-existent', { default: true })).toEqual({
                default: true,
            });
        });
    });

    describe('variationDetails', () => {
        beforeEach(async () => {
            await client.init();
        });

        describe('boolVariationDetails', () => {
            it('should return correct details for existing flag', () => {
                const result = client.boolVariationDetails('bool-enabled');

                expect(result).toEqual({
                    value: true,
                    reason: 'targeting_match',
                    flagExists: true,
                    enabled: true,
                });
            });

            it('should return flag_not_found for non-existent flag', () => {
                const result = client.boolVariationDetails('non-existent');

                expect(result).toEqual({
                    value: false,
                    reason: 'flag_not_found',
                    flagExists: false,
                    enabled: false,
                });
            });
        });

        describe('stringVariationDetails', () => {
            it('should return correct details for string flag', () => {
                const result = client.stringVariationDetails('string-variant');

                expect(result).toEqual({
                    value: 'hello world',
                    reason: 'percentage_rollout',
                    flagExists: true,
                    enabled: true,
                });
            });

            it('should return disabled reason for disabled flag', () => {
                const result = client.stringVariationDetails('disabled-with-payload', 'default');

                expect(result.reason).toBe('disabled');
                expect(result.enabled).toBe(false);
                expect(result.value).toBe('default');
            });
        });

        describe('numberVariationDetails', () => {
            it('should return correct details for number flag', () => {
                const result = client.numberVariationDetails('number-variant');

                expect(result).toEqual({
                    value: 42.5,
                    reason: 'evaluated',
                    flagExists: true,
                    enabled: true,
                });
            });

            it('should return parse_error for invalid number', () => {
                const result = client.numberVariationDetails('invalid-number', 0);

                expect(result.reason).toBe('parse_error');
                expect(result.value).toBe(0);
            });
        });

        describe('jsonVariationDetails', () => {
            it('should return correct details for json flag', () => {
                const result = client.jsonVariationDetails('json-variant', {});

                expect(result).toEqual({
                    value: { key: 'value', nested: { a: 1 } },
                    reason: 'evaluated',
                    flagExists: true,
                    enabled: true,
                });
            });

            it('should return parse_error for invalid json', () => {
                const result = client.jsonVariationDetails('invalid-json', {});

                expect(result.reason).toBe('parse_error');
            });
        });
    });

    describe('variationOrThrow', () => {
        beforeEach(async () => {
            await client.init();
        });

        describe('boolVariationOrThrow', () => {
            it('should return value for existing flag', () => {
                expect(client.boolVariationOrThrow('bool-enabled')).toBe(true);
            });

            it('should throw for non-existent flag', () => {
                expect(() => client.boolVariationOrThrow('non-existent')).toThrow(
                    'Flag "non-existent" not found'
                );
            });
        });

        describe('stringVariationOrThrow', () => {
            it('should return value for enabled string flag', () => {
                expect(client.stringVariationOrThrow('string-variant')).toBe('hello world');
            });

            it('should throw for non-existent flag', () => {
                expect(() => client.stringVariationOrThrow('non-existent')).toThrow(
                    'Flag "non-existent" not found'
                );
            });

            it('should throw for disabled flag', () => {
                expect(() => client.stringVariationOrThrow('bool-disabled')).toThrow(
                    'Flag "bool-disabled" is disabled'
                );
            });
        });

        describe('numberVariationOrThrow', () => {
            it('should return value for valid number flag', () => {
                expect(client.numberVariationOrThrow('number-variant')).toBe(42.5);
            });

            it('should throw for invalid number payload', () => {
                expect(() => client.numberVariationOrThrow('invalid-number')).toThrow(
                    'Flag "invalid-number" has invalid number payload'
                );
            });
        });

        describe('jsonVariationOrThrow', () => {
            it('should return value for valid json flag', () => {
                expect(client.jsonVariationOrThrow('json-variant')).toEqual({
                    key: 'value',
                    nested: { a: 1 },
                });
            });

            it('should throw for invalid json payload', () => {
                expect(() => client.jsonVariationOrThrow('invalid-json')).toThrow(
                    'Flag "invalid-json" has invalid JSON payload'
                );
            });
        });
    });

    describe('getVariant', () => {
        beforeEach(async () => {
            await client.init();
        });

        it('should return variant for existing flag', () => {
            const variant = client.getVariant('string-variant');

            expect(variant).toEqual({
                name: 'variantA',
                enabled: true,
                payload: 'hello world',
            });
        });

        it('should return fallback variant for non-existent flag', () => {
            const variant = client.getVariant('non-existent');

            expect(variant).toEqual({
                name: 'disabled',
                enabled: false,
            });
        });
    });

    describe('context management', () => {
        let consoleErrorSpy: jest.SpyInstance;

        beforeEach(async () => {
            await client.init();
            // Mock console.error to suppress expected error output during context changes
            consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
            // Mock fetch to return empty flags response
            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => ({ success: true, data: { flags: bootstrapFlags } }),
            });
        });

        afterEach(() => {
            consoleErrorSpy.mockRestore();
        });

        it('should get initial context from config', () => {
            const configWithContext: GatrixClientConfig = {
                ...defaultConfig,
                context: { userId: 'user-123', deviceId: 'device-456' },
            };
            const clientWithContext = new FeaturesClient(emitter, configWithContext);

            expect(clientWithContext.getContext()).toMatchObject({
                userId: 'user-123',
                deviceId: 'device-456',
            });
        });

        it('should update context', () => {
            client.updateContext({ userId: 'new-user' });

            expect(client.getContext()).toMatchObject({ userId: 'new-user' });
        });

        it('should merge context with updateContext', () => {
            client.updateContext({ userId: 'user-1' });
            client.updateContext({ deviceId: 'device-1' });

            expect(client.getContext()).toMatchObject({
                userId: 'user-1',
                deviceId: 'device-1',
            });
        });

        it('should set individual context field', () => {
            client.setContextField('userId', 'user-123');

            expect(client.getContext().userId).toBe('user-123');
        });

        it('should remove context field', () => {
            client.updateContext({ userId: 'user-1', deviceId: 'device-1' });
            client.removeContextField('userId');

            expect(client.getContext()).toMatchObject({ deviceId: 'device-1' });
            expect(client.getContext().userId).toBeUndefined();
        });
    });

    describe('error handling', () => {
        it('should emit ERROR event on fetch failure', async () => {
            const errorCallback = jest.fn();
            emitter.on(EVENTS.ERROR, errorCallback);

            mockFetch.mockRejectedValueOnce(new Error('Network error'));

            const errorClient = new FeaturesClient(emitter, {
                ...defaultConfig,
                features: { disableRefresh: true },
            });

            await errorClient.init();
            // Try to fetch which will fail
            await errorClient.fetchFlags();

            expect(errorCallback).toHaveBeenCalled();
            expect(errorClient.getError()).toBeTruthy();
        });
    });

    describe('getAllFlags', () => {
        beforeEach(async () => {
            await client.init();
        });

        it('should return all flags', () => {
            const flags = client.getAllFlags();

            expect(flags).toHaveLength(bootstrapFlags.length);
            expect(flags.map((f) => f.name)).toEqual(expect.arrayContaining(bootstrapFlags.map((f) => f.name)));
        });
    });

    describe('offline mode', () => {
        it('should start successfully with bootstrap data in offline mode', async () => {
            const offlineClient = new FeaturesClient(emitter, {
                ...defaultConfig,
                offlineMode: true,
                features: {
                    bootstrap: bootstrapFlags,
                },
            });

            await offlineClient.init();
            await offlineClient.start();

            expect(offlineClient.isReady()).toBe(true);
            expect(offlineClient.isEnabled('bool-enabled')).toBe(true);
        });

        it('should throw error when offline mode has no data', async () => {
            const offlineClient = new FeaturesClient(emitter, {
                ...defaultConfig,
                offlineMode: true,
                features: {
                    bootstrap: [], // Empty bootstrap
                },
            });

            await offlineClient.init();

            await expect(offlineClient.start()).rejects.toThrow(
                'offlineMode requires bootstrap data or cached flags'
            );
        });

        it('should warn and skip fetchFlags in offline mode', async () => {
            const mockLogger = {
                debug: jest.fn(),
                info: jest.fn(),
                warn: jest.fn(),
                error: jest.fn(),
            };
            const offlineClient = new FeaturesClient(emitter, {
                ...defaultConfig,
                offlineMode: true,
                logger: mockLogger,
                features: {
                    bootstrap: bootstrapFlags,
                },
            });

            await offlineClient.init();
            await offlineClient.start();

            // Try to fetch - should warn and do nothing
            await offlineClient.fetchFlags();

            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining('offline mode')
            );
        });

        it('should not start polling in offline mode', async () => {
            const offlineClient = new FeaturesClient(emitter, {
                ...defaultConfig,
                offlineMode: true,
                features: {
                    bootstrap: bootstrapFlags,
                    refreshInterval: 1, // 1 second
                },
            });

            await offlineClient.init();
            await offlineClient.start();

            // Mock should not be called even after waiting
            expect(mockFetch).not.toHaveBeenCalled();
        });
    });
});
