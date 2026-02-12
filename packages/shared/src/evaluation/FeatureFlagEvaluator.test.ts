/**
 * Comprehensive unit tests for FeatureFlagEvaluator constraint operators.
 * Tests all operators with normal and inverted cases, edge cases, and type coercion.
 */
import { describe, it, expect } from 'vitest';
import { FeatureFlagEvaluator } from './FeatureFlagEvaluator';
import type {
  FeatureFlag,
  EvaluationContext,
  FeatureSegment,
  Constraint,
  ConstraintOperator,
} from './types';

// Helper to create a minimal flag with a single constraint
function createFlagWithConstraint(constraint: Constraint): FeatureFlag {
  return {
    name: 'test-flag',
    isEnabled: true,
    strategies: [
      {
        name: 'test-strategy',
        isEnabled: true,
        sortOrder: 0,
        constraints: [constraint],
      },
    ],
    variants: [],
  };
}

// Helper to evaluate a single constraint against a context
function evalConstraint(constraint: Constraint, context: EvaluationContext): boolean {
  const flag = createFlagWithConstraint(constraint);
  const result = FeatureFlagEvaluator.evaluate(flag, context, new Map());
  return result.enabled;
}

// Helper to create a constraint
function c(
  operator: ConstraintOperator,
  contextName: string,
  opts: {
    value?: string;
    values?: string[];
    inverted?: boolean;
    caseInsensitive?: boolean;
  } = {}
): Constraint {
  return {
    contextName,
    operator,
    value: opts.value,
    values: opts.values,
    inverted: opts.inverted ?? false,
    caseInsensitive: opts.caseInsensitive ?? false,
  };
}

// Default context for most tests
const defaultContext: EvaluationContext = {
  appName: 'test-app',
  properties: {},
};

// ===================== STRING OPERATORS =====================

describe('String Operators', () => {
  describe('str_eq', () => {
    it('should match equal strings', () => {
      expect(
        evalConstraint(c('str_eq', 'region', { value: 'us-east' }), {
          ...defaultContext,
          properties: { region: 'us-east' },
        })
      ).toBe(true);
    });

    it('should not match different strings', () => {
      expect(
        evalConstraint(c('str_eq', 'region', { value: 'us-east' }), {
          ...defaultContext,
          properties: { region: 'eu-west' },
        })
      ).toBe(false);
    });

    it('should support case insensitive', () => {
      expect(
        evalConstraint(c('str_eq', 'region', { value: 'US-EAST', caseInsensitive: true }), {
          ...defaultContext,
          properties: { region: 'us-east' },
        })
      ).toBe(true);
    });

    it('should invert result', () => {
      expect(
        evalConstraint(c('str_eq', 'region', { value: 'us-east', inverted: true }), {
          ...defaultContext,
          properties: { region: 'us-east' },
        })
      ).toBe(false);
    });

    it('should invert non-match (becomes true)', () => {
      expect(
        evalConstraint(c('str_eq', 'region', { value: 'us-east', inverted: true }), {
          ...defaultContext,
          properties: { region: 'eu-west' },
        })
      ).toBe(true);
    });
  });

  describe('str_contains', () => {
    it('should match substring', () => {
      expect(
        evalConstraint(c('str_contains', 'email', { value: '@example.com' }), {
          ...defaultContext,
          properties: { email: 'user@example.com' },
        })
      ).toBe(true);
    });

    it('should not match missing substring', () => {
      expect(
        evalConstraint(c('str_contains', 'email', { value: '@example.com' }), {
          ...defaultContext,
          properties: { email: 'user@other.com' },
        })
      ).toBe(false);
    });

    it('should support case insensitive', () => {
      expect(
        evalConstraint(c('str_contains', 'name', { value: 'ADMIN', caseInsensitive: true }), {
          ...defaultContext,
          properties: { name: 'SuperAdmin' },
        })
      ).toBe(true);
    });

    it('should invert result', () => {
      expect(
        evalConstraint(c('str_contains', 'email', { value: '@example.com', inverted: true }), {
          ...defaultContext,
          properties: { email: 'user@example.com' },
        })
      ).toBe(false);
    });
  });

  describe('str_starts_with', () => {
    it('should match prefix', () => {
      expect(
        evalConstraint(c('str_starts_with', 'path', { value: '/api/' }), {
          ...defaultContext,
          properties: { path: '/api/v1/users' },
        })
      ).toBe(true);
    });

    it('should not match non-prefix', () => {
      expect(
        evalConstraint(c('str_starts_with', 'path', { value: '/api/' }), {
          ...defaultContext,
          properties: { path: '/web/page' },
        })
      ).toBe(false);
    });

    it('should invert result', () => {
      expect(
        evalConstraint(c('str_starts_with', 'path', { value: '/api/', inverted: true }), {
          ...defaultContext,
          properties: { path: '/api/v1/users' },
        })
      ).toBe(false);
    });
  });

  describe('str_ends_with', () => {
    it('should match suffix', () => {
      expect(
        evalConstraint(c('str_ends_with', 'file', { value: '.json' }), {
          ...defaultContext,
          properties: { file: 'config.json' },
        })
      ).toBe(true);
    });

    it('should not match non-suffix', () => {
      expect(
        evalConstraint(c('str_ends_with', 'file', { value: '.json' }), {
          ...defaultContext,
          properties: { file: 'config.yaml' },
        })
      ).toBe(false);
    });
  });

  describe('str_in', () => {
    it('should match value in list', () => {
      expect(
        evalConstraint(c('str_in', 'country', { values: ['US', 'CA', 'MX'] }), {
          ...defaultContext,
          properties: { country: 'CA' },
        })
      ).toBe(true);
    });

    it('should not match value not in list', () => {
      expect(
        evalConstraint(c('str_in', 'country', { values: ['US', 'CA', 'MX'] }), {
          ...defaultContext,
          properties: { country: 'JP' },
        })
      ).toBe(false);
    });

    it('should support case insensitive', () => {
      expect(
        evalConstraint(c('str_in', 'country', { values: ['us', 'ca'], caseInsensitive: true }), {
          ...defaultContext,
          properties: { country: 'US' },
        })
      ).toBe(true);
    });

    it('should invert result (str_not_in equivalent)', () => {
      expect(
        evalConstraint(c('str_in', 'country', { values: ['US', 'CA', 'MX'], inverted: true }), {
          ...defaultContext,
          properties: { country: 'CA' },
        })
      ).toBe(false);
    });

    it('should invert result for non-member (becomes true)', () => {
      expect(
        evalConstraint(c('str_in', 'country', { values: ['US', 'CA', 'MX'], inverted: true }), {
          ...defaultContext,
          properties: { country: 'JP' },
        })
      ).toBe(true);
    });
  });

  describe('str_regex', () => {
    it('should match regex pattern', () => {
      expect(
        evalConstraint(c('str_regex', 'version', { value: '^\\d+\\.\\d+\\.\\d+$' }), {
          ...defaultContext,
          properties: { version: '1.2.3' },
        })
      ).toBe(true);
    });

    it('should not match non-matching pattern', () => {
      expect(
        evalConstraint(c('str_regex', 'version', { value: '^\\d+\\.\\d+\\.\\d+$' }), {
          ...defaultContext,
          properties: { version: 'v1.2.3' },
        })
      ).toBe(false);
    });

    it('should handle invalid regex gracefully', () => {
      expect(
        evalConstraint(c('str_regex', 'value', { value: '[invalid(' }), {
          ...defaultContext,
          properties: { value: 'test' },
        })
      ).toBe(false);
    });

    it('should support case insensitive flag', () => {
      expect(
        evalConstraint(c('str_regex', 'name', { value: '^admin', caseInsensitive: true }), {
          ...defaultContext,
          properties: { name: 'ADMIN_USER' },
        })
      ).toBe(true);
    });
  });
});

// ===================== NUMBER OPERATORS =====================

describe('Number Operators', () => {
  describe('num_eq', () => {
    it('should match equal numbers', () => {
      expect(
        evalConstraint(c('num_eq', 'level', { value: '10' }), {
          ...defaultContext,
          properties: { level: 10 },
        })
      ).toBe(true);
    });

    it('should not match different numbers', () => {
      expect(
        evalConstraint(c('num_eq', 'level', { value: '10' }), {
          ...defaultContext,
          properties: { level: 20 },
        })
      ).toBe(false);
    });

    it('should handle string-to-number coercion', () => {
      expect(
        evalConstraint(c('num_eq', 'level', { value: '10' }), {
          ...defaultContext,
          properties: { level: '10' },
        })
      ).toBe(true);
    });

    it('should invert result', () => {
      expect(
        evalConstraint(c('num_eq', 'level', { value: '10', inverted: true }), {
          ...defaultContext,
          properties: { level: 10 },
        })
      ).toBe(false);
    });
  });

  describe('num_gt', () => {
    it('should match greater values', () => {
      expect(
        evalConstraint(c('num_gt', 'age', { value: '18' }), {
          ...defaultContext,
          properties: { age: 25 },
        })
      ).toBe(true);
    });

    it('should not match equal values', () => {
      expect(
        evalConstraint(c('num_gt', 'age', { value: '18' }), {
          ...defaultContext,
          properties: { age: 18 },
        })
      ).toBe(false);
    });

    it('should not match lesser values', () => {
      expect(
        evalConstraint(c('num_gt', 'age', { value: '18' }), {
          ...defaultContext,
          properties: { age: 10 },
        })
      ).toBe(false);
    });
  });

  describe('num_gte', () => {
    it('should match equal values', () => {
      expect(
        evalConstraint(c('num_gte', 'age', { value: '18' }), {
          ...defaultContext,
          properties: { age: 18 },
        })
      ).toBe(true);
    });

    it('should match greater values', () => {
      expect(
        evalConstraint(c('num_gte', 'age', { value: '18' }), {
          ...defaultContext,
          properties: { age: 25 },
        })
      ).toBe(true);
    });
  });

  describe('num_lt', () => {
    it('should match lesser values', () => {
      expect(
        evalConstraint(c('num_lt', 'age', { value: '18' }), {
          ...defaultContext,
          properties: { age: 10 },
        })
      ).toBe(true);
    });

    it('should not match equal values', () => {
      expect(
        evalConstraint(c('num_lt', 'age', { value: '18' }), {
          ...defaultContext,
          properties: { age: 18 },
        })
      ).toBe(false);
    });
  });

  describe('num_lte', () => {
    it('should match equal values', () => {
      expect(
        evalConstraint(c('num_lte', 'age', { value: '18' }), {
          ...defaultContext,
          properties: { age: 18 },
        })
      ).toBe(true);
    });

    it('should match lesser values', () => {
      expect(
        evalConstraint(c('num_lte', 'age', { value: '18' }), {
          ...defaultContext,
          properties: { age: 10 },
        })
      ).toBe(true);
    });
  });

  describe('num_in', () => {
    it('should match value in list', () => {
      expect(
        evalConstraint(c('num_in', 'tier', { values: ['1', '2', '3'] }), {
          ...defaultContext,
          properties: { tier: 2 },
        })
      ).toBe(true);
    });

    it('should not match value not in list', () => {
      expect(
        evalConstraint(c('num_in', 'tier', { values: ['1', '2', '3'] }), {
          ...defaultContext,
          properties: { tier: 5 },
        })
      ).toBe(false);
    });

    it('should invert result (num_not_in equivalent)', () => {
      expect(
        evalConstraint(c('num_in', 'tier', { values: ['1', '2', '3'], inverted: true }), {
          ...defaultContext,
          properties: { tier: 2 },
        })
      ).toBe(false);
    });
  });
});

// ===================== BOOLEAN OPERATORS =====================

describe('Boolean Operators', () => {
  describe('bool_is', () => {
    it('should match true', () => {
      expect(
        evalConstraint(c('bool_is', 'premium', { value: 'true' }), {
          ...defaultContext,
          properties: { premium: true },
        })
      ).toBe(true);
    });

    it('should match false', () => {
      expect(
        evalConstraint(c('bool_is', 'premium', { value: 'false' }), {
          ...defaultContext,
          properties: { premium: false },
        })
      ).toBe(true);
    });

    it('should not match when different', () => {
      expect(
        evalConstraint(c('bool_is', 'premium', { value: 'true' }), {
          ...defaultContext,
          properties: { premium: false },
        })
      ).toBe(false);
    });

    it('should invert result', () => {
      expect(
        evalConstraint(c('bool_is', 'premium', { value: 'true', inverted: true }), {
          ...defaultContext,
          properties: { premium: true },
        })
      ).toBe(false);
    });
  });
});

// ===================== DATE OPERATORS =====================

describe('Date Operators', () => {
  const testDate = '2025-06-15T12:00:00.000Z';
  const beforeDate = '2025-06-14T12:00:00.000Z';
  const afterDate = '2025-06-16T12:00:00.000Z';

  describe('date_eq', () => {
    it('should match equal dates', () => {
      expect(
        evalConstraint(c('date_eq', 'signup', { value: testDate }), {
          ...defaultContext,
          properties: { signup: testDate },
        })
      ).toBe(true);
    });

    it('should not match different dates', () => {
      expect(
        evalConstraint(c('date_eq', 'signup', { value: testDate }), {
          ...defaultContext,
          properties: { signup: beforeDate },
        })
      ).toBe(false);
    });

    it('should invert result', () => {
      expect(
        evalConstraint(c('date_eq', 'signup', { value: testDate, inverted: true }), {
          ...defaultContext,
          properties: { signup: testDate },
        })
      ).toBe(false);
    });
  });

  describe('date_gt', () => {
    it('should match later dates', () => {
      expect(
        evalConstraint(c('date_gt', 'signup', { value: testDate }), {
          ...defaultContext,
          properties: { signup: afterDate },
        })
      ).toBe(true);
    });

    it('should not match equal dates', () => {
      expect(
        evalConstraint(c('date_gt', 'signup', { value: testDate }), {
          ...defaultContext,
          properties: { signup: testDate },
        })
      ).toBe(false);
    });

    it('should not match earlier dates', () => {
      expect(
        evalConstraint(c('date_gt', 'signup', { value: testDate }), {
          ...defaultContext,
          properties: { signup: beforeDate },
        })
      ).toBe(false);
    });
  });

  describe('date_gte', () => {
    it('should match equal dates', () => {
      expect(
        evalConstraint(c('date_gte', 'signup', { value: testDate }), {
          ...defaultContext,
          properties: { signup: testDate },
        })
      ).toBe(true);
    });

    it('should match later dates', () => {
      expect(
        evalConstraint(c('date_gte', 'signup', { value: testDate }), {
          ...defaultContext,
          properties: { signup: afterDate },
        })
      ).toBe(true);
    });
  });

  describe('date_lt', () => {
    it('should match earlier dates', () => {
      expect(
        evalConstraint(c('date_lt', 'signup', { value: testDate }), {
          ...defaultContext,
          properties: { signup: beforeDate },
        })
      ).toBe(true);
    });

    it('should not match equal dates', () => {
      expect(
        evalConstraint(c('date_lt', 'signup', { value: testDate }), {
          ...defaultContext,
          properties: { signup: testDate },
        })
      ).toBe(false);
    });
  });

  describe('date_lte', () => {
    it('should match equal dates', () => {
      expect(
        evalConstraint(c('date_lte', 'signup', { value: testDate }), {
          ...defaultContext,
          properties: { signup: testDate },
        })
      ).toBe(true);
    });

    it('should match earlier dates', () => {
      expect(
        evalConstraint(c('date_lte', 'signup', { value: testDate }), {
          ...defaultContext,
          properties: { signup: beforeDate },
        })
      ).toBe(true);
    });
  });
});

// ===================== SEMVER OPERATORS =====================

describe('Semver Operators', () => {
  describe('semver_eq', () => {
    it('should match equal versions', () => {
      expect(
        evalConstraint(c('semver_eq', 'appVersion', { value: '1.2.3' }), {
          ...defaultContext,
          appVersion: '1.2.3',
        })
      ).toBe(true);
    });

    it('should not match different versions', () => {
      expect(
        evalConstraint(c('semver_eq', 'appVersion', { value: '1.2.3' }), {
          ...defaultContext,
          appVersion: '1.2.4',
        })
      ).toBe(false);
    });
  });

  describe('semver_gt', () => {
    it('should match greater versions', () => {
      expect(
        evalConstraint(c('semver_gt', 'appVersion', { value: '1.2.3' }), {
          ...defaultContext,
          appVersion: '1.3.0',
        })
      ).toBe(true);
    });

    it('should detect major version difference', () => {
      expect(
        evalConstraint(c('semver_gt', 'appVersion', { value: '1.2.3' }), {
          ...defaultContext,
          appVersion: '2.0.0',
        })
      ).toBe(true);
    });

    it('should not match equal versions', () => {
      expect(
        evalConstraint(c('semver_gt', 'appVersion', { value: '1.2.3' }), {
          ...defaultContext,
          appVersion: '1.2.3',
        })
      ).toBe(false);
    });
  });

  describe('semver_gte', () => {
    it('should match equal versions', () => {
      expect(
        evalConstraint(c('semver_gte', 'appVersion', { value: '1.2.3' }), {
          ...defaultContext,
          appVersion: '1.2.3',
        })
      ).toBe(true);
    });
  });

  describe('semver_lt', () => {
    it('should match lesser versions', () => {
      expect(
        evalConstraint(c('semver_lt', 'appVersion', { value: '2.0.0' }), {
          ...defaultContext,
          appVersion: '1.9.9',
        })
      ).toBe(true);
    });
  });

  describe('semver_lte', () => {
    it('should match equal versions', () => {
      expect(
        evalConstraint(c('semver_lte', 'appVersion', { value: '1.2.3' }), {
          ...defaultContext,
          appVersion: '1.2.3',
        })
      ).toBe(true);
    });
  });

  describe('semver_in', () => {
    it('should match version in list', () => {
      expect(
        evalConstraint(c('semver_in', 'appVersion', { values: ['1.0.0', '1.1.0', '1.2.0'] }), {
          ...defaultContext,
          appVersion: '1.1.0',
        })
      ).toBe(true);
    });

    it('should not match version not in list', () => {
      expect(
        evalConstraint(c('semver_in', 'appVersion', { values: ['1.0.0', '1.1.0', '1.2.0'] }), {
          ...defaultContext,
          appVersion: '2.0.0',
        })
      ).toBe(false);
    });

    it('should invert result (semver_not_in equivalent)', () => {
      expect(
        evalConstraint(
          c('semver_in', 'appVersion', { values: ['1.0.0', '1.1.0'], inverted: true }),
          { ...defaultContext, appVersion: '1.1.0' }
        )
      ).toBe(false);
    });
  });
});

// ===================== COMMON OPERATORS (EXISTS / NOT_EXISTS) =====================

describe('Common Operators', () => {
  describe('exists', () => {
    it('should return true when property exists', () => {
      expect(
        evalConstraint(c('exists', 'region'), {
          ...defaultContext,
          properties: { region: 'us-east' },
        })
      ).toBe(true);
    });

    it('should return true for empty string (value exists)', () => {
      expect(
        evalConstraint(c('exists', 'region'), { ...defaultContext, properties: { region: '' } })
      ).toBe(true);
    });

    it('should return true for zero (value exists)', () => {
      expect(
        evalConstraint(c('exists', 'count'), { ...defaultContext, properties: { count: 0 } })
      ).toBe(true);
    });

    it('should return true for false (value exists)', () => {
      expect(
        evalConstraint(c('exists', 'active'), { ...defaultContext, properties: { active: false } })
      ).toBe(true);
    });

    it('should return false when property does not exist', () => {
      expect(evalConstraint(c('exists', 'region'), { ...defaultContext, properties: {} })).toBe(
        false
      );
    });

    it('should return false for missing properties', () => {
      expect(evalConstraint(c('exists', 'region'), defaultContext)).toBe(false);
    });

    it('should invert result', () => {
      expect(
        evalConstraint(c('exists', 'region', { inverted: true }), {
          ...defaultContext,
          properties: { region: 'us-east' },
        })
      ).toBe(false);
    });

    it('should work with built-in context fields', () => {
      expect(evalConstraint(c('exists', 'userId'), { ...defaultContext, userId: 'user-1' })).toBe(
        true
      );
    });

    it('should return false for missing built-in context fields', () => {
      expect(evalConstraint(c('exists', 'userId'), defaultContext)).toBe(false);
    });
  });

  describe('not_exists', () => {
    it('should return true when property does not exist', () => {
      expect(evalConstraint(c('not_exists', 'region'), { ...defaultContext, properties: {} })).toBe(
        true
      );
    });

    it('should return false when property exists', () => {
      expect(
        evalConstraint(c('not_exists', 'region'), {
          ...defaultContext,
          properties: { region: 'us-east' },
        })
      ).toBe(false);
    });

    it('should invert result (becomes exists)', () => {
      expect(
        evalConstraint(c('not_exists', 'region', { inverted: true }), {
          ...defaultContext,
          properties: {},
        })
      ).toBe(false);
    });
  });
});

// ===================== ARRAY OPERATORS =====================

describe('Array Operators', () => {
  describe('arr_any', () => {
    it('should match when array includes any target value', () => {
      expect(
        evalConstraint(c('arr_any', 'tags', { values: ['premium', 'vip'] }), {
          ...defaultContext,
          properties: { tags: ['basic', 'premium', 'trial'] },
        })
      ).toBe(true);
    });

    it('should not match when array includes none of the target values', () => {
      expect(
        evalConstraint(c('arr_any', 'tags', { values: ['premium', 'vip'] }), {
          ...defaultContext,
          properties: { tags: ['basic', 'trial'] },
        })
      ).toBe(false);
    });

    it('should handle empty arrays', () => {
      expect(
        evalConstraint(c('arr_any', 'tags', { values: ['premium'] }), {
          ...defaultContext,
          properties: { tags: [] },
        })
      ).toBe(false);
    });

    it('should support case insensitive', () => {
      expect(
        evalConstraint(c('arr_any', 'tags', { values: ['PREMIUM'], caseInsensitive: true }), {
          ...defaultContext,
          properties: { tags: ['basic', 'premium'] },
        })
      ).toBe(true);
    });

    it('should invert result', () => {
      expect(
        evalConstraint(c('arr_any', 'tags', { values: ['premium'], inverted: true }), {
          ...defaultContext,
          properties: { tags: ['basic', 'premium'] },
        })
      ).toBe(false);
    });

    it('should handle non-array values as empty arrays', () => {
      expect(
        evalConstraint(c('arr_any', 'tags', { values: ['premium'] }), {
          ...defaultContext,
          properties: { tags: 'premium' },
        })
      ).toBe(false);
    });
  });

  describe('arr_all', () => {
    it('should match when array includes all target values', () => {
      expect(
        evalConstraint(c('arr_all', 'tags', { values: ['premium', 'vip'] }), {
          ...defaultContext,
          properties: { tags: ['basic', 'premium', 'vip'] },
        })
      ).toBe(true);
    });

    it('should not match when array is missing some target values', () => {
      expect(
        evalConstraint(c('arr_all', 'tags', { values: ['premium', 'vip'] }), {
          ...defaultContext,
          properties: { tags: ['basic', 'premium'] },
        })
      ).toBe(false);
    });

    it('should handle empty target values', () => {
      expect(
        evalConstraint(c('arr_all', 'tags', { values: [] }), {
          ...defaultContext,
          properties: { tags: ['basic'] },
        })
      ).toBe(false);
    });

    it('should support case insensitive', () => {
      expect(
        evalConstraint(
          c('arr_all', 'tags', { values: ['PREMIUM', 'VIP'], caseInsensitive: true }),
          { ...defaultContext, properties: { tags: ['premium', 'vip', 'basic'] } }
        )
      ).toBe(true);
    });

    it('should invert result', () => {
      expect(
        evalConstraint(c('arr_all', 'tags', { values: ['premium', 'vip'], inverted: true }), {
          ...defaultContext,
          properties: { tags: ['premium', 'vip'] },
        })
      ).toBe(false);
    });
  });

  describe('arr_empty', () => {
    it('should return true for empty array', () => {
      expect(
        evalConstraint(c('arr_empty', 'tags'), { ...defaultContext, properties: { tags: [] } })
      ).toBe(true);
    });

    it('should return false for non-empty array', () => {
      expect(
        evalConstraint(c('arr_empty', 'tags'), { ...defaultContext, properties: { tags: ['a'] } })
      ).toBe(false);
    });

    it('should return true for non-array values (treated as empty)', () => {
      expect(
        evalConstraint(c('arr_empty', 'tags'), {
          ...defaultContext,
          properties: { tags: 'not-array' },
        })
      ).toBe(true);
    });

    it('should return true for undefined property (treated as empty)', () => {
      expect(evalConstraint(c('arr_empty', 'tags'), { ...defaultContext, properties: {} })).toBe(
        true
      );
    });

    it('should invert result (arr_not_empty equivalent)', () => {
      expect(
        evalConstraint(c('arr_empty', 'tags', { inverted: true }), {
          ...defaultContext,
          properties: { tags: ['a'] },
        })
      ).toBe(true);
    });

    it('should invert result for empty array', () => {
      expect(
        evalConstraint(c('arr_empty', 'tags', { inverted: true }), {
          ...defaultContext,
          properties: { tags: [] },
        })
      ).toBe(false);
    });
  });
});

// ===================== EDGE CASES =====================

describe('Edge Cases', () => {
  describe('undefined context values', () => {
    it('should return false for undefined context with normal operator', () => {
      expect(evalConstraint(c('str_eq', 'missing_field', { value: 'test' }), defaultContext)).toBe(
        false
      );
    });

    it('should return true for undefined context with inverted normal operator', () => {
      expect(
        evalConstraint(
          c('str_eq', 'missing_field', { value: 'test', inverted: true }),
          defaultContext
        )
      ).toBe(true);
    });
  });

  describe('built-in context fields', () => {
    it('should resolve userId', () => {
      expect(
        evalConstraint(c('str_eq', 'userId', { value: 'user-123' }), {
          ...defaultContext,
          userId: 'user-123',
        })
      ).toBe(true);
    });

    it('should resolve sessionId', () => {
      expect(
        evalConstraint(c('str_eq', 'sessionId', { value: 'session-abc' }), {
          ...defaultContext,
          sessionId: 'session-abc',
        })
      ).toBe(true);
    });

    it('should resolve appName', () => {
      expect(
        evalConstraint(c('str_eq', 'appName', { value: 'test-app' }), {
          ...defaultContext,
          appName: 'test-app',
        })
      ).toBe(true);
    });

    it('should resolve appVersion', () => {
      expect(
        evalConstraint(c('str_eq', 'appVersion', { value: '1.0.0' }), {
          ...defaultContext,
          appVersion: '1.0.0',
        })
      ).toBe(true);
    });

    it('should resolve remoteAddress', () => {
      expect(
        evalConstraint(c('str_eq', 'remoteAddress', { value: '192.168.1.1' }), {
          ...defaultContext,
          remoteAddress: '192.168.1.1',
        })
      ).toBe(true);
    });
  });

  describe('unknown operator', () => {
    it('should return false for unknown operator', () => {
      expect(
        evalConstraint(c('unknown_op' as ConstraintOperator, 'field', { value: 'test' }), {
          ...defaultContext,
          properties: { field: 'test' },
        })
      ).toBe(false);
    });
  });

  describe('multiple constraints', () => {
    it('should require all constraints to pass (AND logic)', () => {
      const flag: FeatureFlag = {
        name: 'test-flag',
        isEnabled: true,
        strategies: [
          {
            name: 'test-strategy',
            isEnabled: true,
            sortOrder: 0,
            constraints: [
              c('str_eq', 'region', { value: 'us-east' }),
              c('num_gte', 'level', { value: '10' }),
            ],
          },
        ],
        variants: [],
      };

      // Both match
      expect(
        FeatureFlagEvaluator.evaluate(
          flag,
          { ...defaultContext, properties: { region: 'us-east', level: 15 } },
          new Map()
        ).enabled
      ).toBe(true);

      // Only one matches
      expect(
        FeatureFlagEvaluator.evaluate(
          flag,
          { ...defaultContext, properties: { region: 'us-east', level: 5 } },
          new Map()
        ).enabled
      ).toBe(false);

      // Neither matches
      expect(
        FeatureFlagEvaluator.evaluate(
          flag,
          { ...defaultContext, properties: { region: 'eu-west', level: 5 } },
          new Map()
        ).enabled
      ).toBe(false);
    });
  });
});
