/**
 * Unit tests for variant source naming in FeatureFlagEvaluator.
 * Validates that the evaluator returns the correct variant names:
 * - $flag-default-enabled: when enabled flag uses flag-level enabledValue
 * - $flag-default-disabled: when disabled flag uses flag-level disabledValue
 * - Actual variant name: when a specific variant is selected
 */
import { describe, it, expect } from 'vitest';
import { FeatureFlagEvaluator } from './FeatureFlagEvaluator';
import type { FeatureFlag, EvaluationContext, FeatureSegment } from './types';

const emptySegmentsMap = new Map<string, FeatureSegment>();
const defaultContext: EvaluationContext = {
    userId: 'user-1',
    appName: 'test-app',
};

function createFlag(overrides: Partial<FeatureFlag> = {}): FeatureFlag {
    return {
        id: 'flag-1',
        name: 'test-flag',
        isEnabled: true,
        impressionDataEnabled: false,
        strategies: [],
        variants: [],
        valueType: 'boolean',
        enabledValue: true,
        disabledValue: false,
        ...overrides,
    };
}

describe('Variant Source Naming', () => {
    describe('Enabled flag with no variants and no strategies', () => {
        it('should return $flag-default-enabled variant name', () => {
            const flag = createFlag({ isEnabled: true, enabledValue: true });
            const result = FeatureFlagEvaluator.evaluate(flag, defaultContext, emptySegmentsMap);
            expect(result.enabled).toBe(true);
            expect(result.variant.name).toBe('$flag-default-enabled');
            expect(result.variant.value).toBe(true);
            expect(result.reason).toBe('default');
        });

        it('should return $flag-default-enabled for string type', () => {
            const flag = createFlag({
                isEnabled: true,
                valueType: 'string',
                enabledValue: 'hello',
            });
            const result = FeatureFlagEvaluator.evaluate(flag, defaultContext, emptySegmentsMap);
            expect(result.variant.name).toBe('$flag-default-enabled');
            expect(result.variant.value).toBe('hello');
        });

        it('should return $flag-default-enabled for number type', () => {
            const flag = createFlag({
                isEnabled: true,
                valueType: 'number',
                enabledValue: 42,
            });
            const result = FeatureFlagEvaluator.evaluate(flag, defaultContext, emptySegmentsMap);
            expect(result.variant.name).toBe('$flag-default-enabled');
            expect(result.variant.value).toBe(42);
        });

        it('should return $flag-default-enabled for json type', () => {
            const flag = createFlag({
                isEnabled: true,
                valueType: 'json',
                enabledValue: { key: 'value' },
            });
            const result = FeatureFlagEvaluator.evaluate(flag, defaultContext, emptySegmentsMap);
            expect(result.variant.name).toBe('$flag-default-enabled');
            expect(result.variant.value).toEqual({ key: 'value' });
        });
    });

    describe('Disabled flag', () => {
        it('should return $flag-default-disabled variant name', () => {
            const flag = createFlag({ isEnabled: false, disabledValue: false });
            const result = FeatureFlagEvaluator.evaluate(flag, defaultContext, emptySegmentsMap);
            expect(result.enabled).toBe(false);
            expect(result.variant.name).toBe('$flag-default-disabled');
            expect(result.variant.value).toBe(false);
            expect(result.reason).toBe('disabled');
        });

        it('should return $flag-default-disabled for string type', () => {
            const flag = createFlag({
                isEnabled: false,
                valueType: 'string',
                disabledValue: 'off',
            });
            const result = FeatureFlagEvaluator.evaluate(flag, defaultContext, emptySegmentsMap);
            expect(result.variant.name).toBe('$flag-default-disabled');
            expect(result.variant.value).toBe('off');
        });
    });

    describe('Enabled flag with strategy match but no variant selected', () => {
        it('should return $flag-default-enabled when strategy matches but no variant', () => {
            const flag = createFlag({
                isEnabled: true,
                enabledValue: true,
                strategies: [
                    {
                        name: 'default-strategy',
                        isEnabled: true,
                        constraints: [],
                    },
                ],
            });
            const result = FeatureFlagEvaluator.evaluate(flag, defaultContext, emptySegmentsMap);
            expect(result.enabled).toBe(true);
            expect(result.variant.name).toBe('$flag-default-enabled');
            expect(result.reason).toBe('strategy_match');
        });
    });

    describe('Enabled flag with strategy match and variant selected', () => {
        it('should return actual variant name when variant is selected', () => {
            const flag = createFlag({
                isEnabled: true,
                enabledValue: true,
                strategies: [
                    {
                        name: 'test-strategy',
                        isEnabled: true,
                        constraints: [],
                    },
                ],
                variants: [
                    {
                        name: 'variant-a',
                        weight: 100,
                        value: 'value-a',
                    },
                ],
            });
            const result = FeatureFlagEvaluator.evaluate(flag, defaultContext, emptySegmentsMap);
            expect(result.enabled).toBe(true);
            expect(result.variant.name).toBe('variant-a');
            expect(result.variant.value).toBe('value-a');
        });
    });

    describe('Enabled flag with no matching strategy', () => {
        it('should return $flag-default-disabled when strategies exist but none match', () => {
            const flag = createFlag({
                isEnabled: true,
                disabledValue: false,
                strategies: [
                    {
                        name: 'restrictive-strategy',
                        isEnabled: true,
                        constraints: [
                            {
                                contextName: 'userId',
                                operator: 'str_eq',
                                value: 'nonexistent-user',
                            },
                        ],
                    },
                ],
            });
            const result = FeatureFlagEvaluator.evaluate(flag, defaultContext, emptySegmentsMap);
            expect(result.enabled).toBe(false);
            expect(result.variant.name).toBe('$flag-default-disabled');
            expect(result.reason).toBe('default');
        });
    });

    describe('getFallbackValue', () => {
        it('should return type-appropriate defaults when value is null/undefined', () => {
            expect(FeatureFlagEvaluator.getFallbackValue(undefined, 'boolean')).toBe(false);
            expect(FeatureFlagEvaluator.getFallbackValue(undefined, 'string')).toBe('');
            expect(FeatureFlagEvaluator.getFallbackValue(undefined, 'number')).toBe(0);
            expect(FeatureFlagEvaluator.getFallbackValue(undefined, 'json')).toEqual({});
        });

        it('should return the value itself when it is defined', () => {
            expect(FeatureFlagEvaluator.getFallbackValue(true, 'boolean')).toBe(true);
            expect(FeatureFlagEvaluator.getFallbackValue('hello', 'string')).toBe('hello');
            expect(FeatureFlagEvaluator.getFallbackValue(42, 'number')).toBe(42);
            expect(FeatureFlagEvaluator.getFallbackValue({ a: 1 }, 'json')).toEqual({ a: 1 });
        });
    });

    describe('Environment override valueSource', () => {
        it('should return $env-default-enabled when valueSource is environment', () => {
            const flag = createFlag({
                isEnabled: true,
                enabledValue: 'env-value',
                valueSource: 'environment',
            });
            const result = FeatureFlagEvaluator.evaluate(flag, defaultContext, emptySegmentsMap);
            expect(result.enabled).toBe(true);
            expect(result.variant.name).toBe('$env-default-enabled');
            expect(result.variant.value).toBe('env-value');
        });

        it('should return $env-default-disabled when disabled with valueSource environment', () => {
            const flag = createFlag({
                isEnabled: false,
                disabledValue: 'env-off',
                valueSource: 'environment',
            });
            const result = FeatureFlagEvaluator.evaluate(flag, defaultContext, emptySegmentsMap);
            expect(result.enabled).toBe(false);
            expect(result.variant.name).toBe('$env-default-disabled');
            expect(result.variant.value).toBe('env-off');
        });

        it('should return $env-default-enabled on strategy match with no variant and env source', () => {
            const flag = createFlag({
                isEnabled: true,
                enabledValue: 99,
                valueType: 'number',
                valueSource: 'environment',
                strategies: [
                    {
                        name: 'default-strategy',
                        isEnabled: true,
                        constraints: [],
                    },
                ],
            });
            const result = FeatureFlagEvaluator.evaluate(flag, defaultContext, emptySegmentsMap);
            expect(result.enabled).toBe(true);
            expect(result.variant.name).toBe('$env-default-enabled');
            expect(result.reason).toBe('strategy_match');
        });

        it('should return $flag-default-enabled when valueSource is flag (explicit)', () => {
            const flag = createFlag({
                isEnabled: true,
                enabledValue: true,
                valueSource: 'flag',
            });
            const result = FeatureFlagEvaluator.evaluate(flag, defaultContext, emptySegmentsMap);
            expect(result.variant.name).toBe('$flag-default-enabled');
        });

        it('should return $flag-default-enabled when valueSource is undefined (backward compat)', () => {
            const flag = createFlag({
                isEnabled: true,
                enabledValue: true,
            });
            const result = FeatureFlagEvaluator.evaluate(flag, defaultContext, emptySegmentsMap);
            expect(result.variant.name).toBe('$flag-default-enabled');
        });
    });
});
