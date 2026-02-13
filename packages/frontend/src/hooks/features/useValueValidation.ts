/**
 * Hook for real-time validation of feature flag values
 * Uses the same validation logic as the backend for consistency
 */

import { useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ValidationRules } from '../../services/featureFlagService';

export interface UseValueValidationResult {
    /** Validate a value and return errors */
    validate: (value: any) => string[];
    /** Check if a value is valid */
    isValid: (value: any) => boolean;
}

export function useValueValidation(
    valueType: 'string' | 'number' | 'boolean' | 'json',
    rules?: ValidationRules | null
): UseValueValidationResult {
    const { t } = useTranslation();

    const validate = useCallback(
        (value: any): string[] => {
            const errors: string[] = [];

            if (!rules) return errors;

            // Check allowEmpty
            const isEmpty = value === null || value === undefined || value === '';
            if (isEmpty) {
                if (rules.allowEmpty === false) {
                    errors.push(t('featureFlags.validation.valueCannotBeEmpty'));
                }
                return errors;
            }

            switch (valueType) {
                case 'string':
                    validateString(String(value), rules, errors, t);
                    break;
                case 'number':
                    validateNumber(value, rules, errors, t);
                    break;
                case 'json':
                    validateJson(value, rules, errors, t);
                    break;
                case 'boolean':
                    // No additional validation for boolean
                    break;
            }

            return errors;
        },
        [valueType, rules, t]
    );

    const isValid = useCallback(
        (value: any): boolean => validate(value).length === 0,
        [validate]
    );

    return useMemo(() => ({ validate, isValid }), [validate, isValid]);
}

function validateString(
    value: string,
    rules: ValidationRules,
    errors: string[],
    t: (key: string, opts?: any) => string
): void {
    // Check whitespace
    if (rules.trimWhitespace === 'reject' && value !== value.trim()) {
        errors.push(t('featureFlags.validation.noWhitespace'));
    }

    const checkValue = rules.trimWhitespace === 'trim' ? value.trim() : value;

    if (rules.minLength !== undefined && rules.minLength !== null && checkValue.length < rules.minLength) {
        errors.push(t('featureFlags.validation.minLength', { min: rules.minLength }));
    }

    if (rules.maxLength !== undefined && rules.maxLength !== null && checkValue.length > rules.maxLength) {
        errors.push(t('featureFlags.validation.maxLength', { max: rules.maxLength }));
    }

    if (rules.pattern) {
        try {
            const regex = new RegExp(rules.pattern);
            if (!regex.test(checkValue)) {
                errors.push(
                    rules.patternDescription || t('featureFlags.validation.patternMismatch', { pattern: rules.pattern })
                );
            }
        } catch {
            errors.push(t('featureFlags.validation.invalidPattern'));
        }
    }

    if (rules.legalValues && rules.legalValues.length > 0) {
        if (!rules.legalValues.includes(checkValue)) {
            errors.push(t('featureFlags.validation.notInLegalValues'));
        }
    }
}

function validateNumber(
    value: any,
    rules: ValidationRules,
    errors: string[],
    t: (key: string, opts?: any) => string
): void {
    const numValue = typeof value === 'number' ? value : Number(value);

    if (isNaN(numValue)) {
        errors.push(t('featureFlags.validation.invalidNumber'));
        return;
    }

    if (rules.integerOnly && !Number.isInteger(numValue)) {
        errors.push(t('featureFlags.validation.integerOnly'));
    }

    if (rules.min !== undefined && rules.min !== null && numValue < rules.min) {
        errors.push(t('featureFlags.validation.minValue', { min: rules.min }));
    }

    if (rules.max !== undefined && rules.max !== null && numValue > rules.max) {
        errors.push(t('featureFlags.validation.maxValue', { max: rules.max }));
    }
}

function validateJson(
    value: any,
    rules: ValidationRules,
    errors: string[],
    t: (key: string, opts?: any) => string
): void {
    if (typeof value === 'string') {
        try {
            JSON.parse(value);
        } catch {
            errors.push(t('featureFlags.validation.invalidJson'));
            return;
        }
    }

    if (rules.jsonSchema) {
        // Basic JSON Schema check - structural validation only
        try {
            const schema = typeof rules.jsonSchema === 'string'
                ? JSON.parse(rules.jsonSchema)
                : rules.jsonSchema;

            const jsonObj = typeof value === 'string' ? JSON.parse(value) : value;

            if (schema.required && Array.isArray(schema.required)) {
                for (const field of schema.required) {
                    if (jsonObj[field] === undefined || jsonObj[field] === null) {
                        errors.push(t('featureFlags.validation.missingRequired', { field }));
                    }
                }
            }
        } catch {
            errors.push(t('featureFlags.validation.invalidJsonSchema'));
        }
    }
}
