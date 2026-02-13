/**
 * Feature flag value validation utility
 * Validates flag values against type-specific validation rules
 */

import { ValueType, ValidationRules } from '../models/FeatureFlag';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  /** Transformed value (e.g. trimmed string) */
  transformedValue?: any;
}

/**
 * Validate a flag value against its type and validation rules
 */
export function validateFlagValue(
  value: any,
  valueType: ValueType,
  rules?: ValidationRules | null
): ValidationResult {
  const errors: string[] = [];
  let transformedValue = value;

  // Check if value is not provided (null/undefined)
  // isRequired means the field must have a value
  const isNotProvided = value === null || value === undefined;

  if (isNotProvided) {
    if (rules && rules.isRequired === true) {
      // Context field is required but value not provided
      errors.push('EMPTY_NOT_ALLOWED');
      return { valid: false, errors, transformedValue };
    }
    // Field is not required or no rules - value not provided is OK
    return { valid: true, errors, transformedValue };
  }

  // No rules = always valid
  if (!rules) {
    return { valid: true, errors };
  }

  switch (valueType) {
    case 'string':
      transformedValue = validateString(value, rules, errors);
      break;
    case 'number':
      validateNumber(value, rules, errors);
      break;
    case 'json':
      validateJson(value, rules, errors);
      break;
    case 'boolean':
      // No additional validation for boolean
      break;
  }

  return { valid: errors.length === 0, errors, transformedValue };
}

/**
 * Validate string value
 */
function validateString(value: any, rules: ValidationRules, errors: string[]): any {
  const strValue = String(value);
  let result = strValue;

  // Handle whitespace trimming
  if (rules.trimWhitespace === 'trim') {
    result = strValue.trim();
  } else if (rules.trimWhitespace === 'trimStart') {
    result = strValue.trimStart();
  } else if (rules.trimWhitespace === 'trimEnd') {
    result = strValue.trimEnd();
  } else if (rules.trimWhitespace === 'reject') {
    if (strValue !== strValue.trim()) {
      errors.push('WHITESPACE_REJECTED');
    }
  }

  // Check after potential trim for length validations
  const checkValue = rules.trimWhitespace === 'trim' ? result : strValue;

  if (
    rules.minLength !== undefined &&
    rules.minLength !== null &&
    checkValue.length < rules.minLength
  ) {
    errors.push(`MIN_LENGTH:${rules.minLength}`);
  }

  if (
    rules.maxLength !== undefined &&
    rules.maxLength !== null &&
    checkValue.length > rules.maxLength
  ) {
    errors.push(`MAX_LENGTH:${rules.maxLength}`);
  }

  if (rules.pattern) {
    try {
      const regex = new RegExp(rules.pattern);
      if (!regex.test(checkValue)) {
        // Use structured format so frontend can produce localized message
        if (rules.patternDescription) {
          errors.push(`PATTERN_MISMATCH:${rules.patternDescription}`);
        } else {
          errors.push(`PATTERN_MISMATCH_RAW:${rules.pattern}`);
        }
      }
    } catch (e) {
      errors.push(`INVALID_PATTERN:${rules.pattern}`);
    }
  }

  if (rules.legalValues && rules.legalValues.length > 0) {
    if (!rules.legalValues.includes(checkValue)) {
      errors.push(`LEGAL_VALUES:${rules.legalValues.join(',')}`);
    }
  }

  return result;
}

/**
 * Validate number value
 */
function validateNumber(value: any, rules: ValidationRules, errors: string[]): void {
  const numValue = typeof value === 'number' ? value : Number(value);

  if (isNaN(numValue)) {
    errors.push('INVALID_NUMBER');
    return;
  }

  if (rules.integerOnly && !Number.isInteger(numValue)) {
    errors.push('INTEGER_ONLY');
  }

  if (rules.min !== undefined && rules.min !== null && numValue < rules.min) {
    errors.push(`MIN_VALUE:${rules.min}`);
  }

  if (rules.max !== undefined && rules.max !== null && numValue > rules.max) {
    errors.push(`MAX_VALUE:${rules.max}`);
  }
}

/**
 * Validate JSON value
 */
function validateJson(value: any, rules: ValidationRules, errors: string[]): void {
  // Ensure value is a valid object
  let jsonObj: any;
  if (typeof value === 'string') {
    try {
      jsonObj = JSON.parse(value);
    } catch (e) {
      errors.push('INVALID_JSON');
      return;
    }
  } else {
    jsonObj = value;
  }

  // JSON Schema validation (optional, using basic structure check)
  if (rules.jsonSchema) {
    try {
      const schema =
        typeof rules.jsonSchema === 'string' ? JSON.parse(rules.jsonSchema) : rules.jsonSchema;

      // Basic JSON Schema validation without external library
      // Check required fields if defined in schema
      if (schema.required && Array.isArray(schema.required)) {
        for (const field of schema.required) {
          if (jsonObj[field] === undefined || jsonObj[field] === null) {
            errors.push(`JSON_REQUIRED_FIELD:${field}`);
          }
        }
      }

      // Check property types if defined
      if (schema.properties && typeof jsonObj === 'object' && jsonObj !== null) {
        for (const [key, propSchema] of Object.entries(schema.properties)) {
          const prop = propSchema as any;
          if (jsonObj[key] !== undefined && prop.type) {
            const actualType = Array.isArray(jsonObj[key]) ? 'array' : typeof jsonObj[key];
            if (actualType !== prop.type) {
              errors.push(`JSON_TYPE_MISMATCH:${key}:${prop.type}:${actualType}`);
            }
          }
        }
      }
    } catch (e) {
      errors.push('INVALID_JSON_SCHEMA');
    }
  }
}
