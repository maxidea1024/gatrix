/**
 * Unit tests for Feature Flag Strategy classes.
 * Tests all strategy types with isEnabled and isEnabledWithDetails.
 */
import { describe, it, expect } from 'vitest';
import { DefaultStrategy } from './DefaultStrategy';
import { FlexibleRolloutStrategy } from './FlexibleRolloutStrategy';
import { UserWithIdStrategy } from './UserWithIdStrategy';
import { GradualRolloutUserIdStrategy } from './GradualRolloutUserIdStrategy';
import { GradualRolloutRandomStrategy } from './GradualRolloutRandomStrategy';
import { GradualRolloutSessionIdStrategy } from './GradualRolloutSessionIdStrategy';
import { RemoteAddressStrategy } from './RemoteAddressStrategy';
import { ApplicationHostnameStrategy } from './ApplicationHostnameStrategy';
import { evaluateStrategyWithDetails, getStrategy } from './index';
import { normalizedStrategyValue } from './util';
import type { EvaluationContext, StrategyParameters } from '../types';

const defaultContext: EvaluationContext = {
  appName: 'test-app',
  properties: {},
};

// ==================== DefaultStrategy ====================

describe('DefaultStrategy', () => {
  const strategy = new DefaultStrategy();

  it('should have name "default"', () => {
    expect(strategy.name).toBe('default');
  });

  it('should always return true', () => {
    expect(strategy.isEnabled({}, defaultContext)).toBe(true);
    expect(strategy.isEnabled({}, {})).toBe(true);
  });

  it('should return detailed result', () => {
    const result = strategy.isEnabledWithDetails({}, defaultContext);
    expect(result.enabled).toBe(true);
    expect(result.reason).toBeTruthy();
  });
});

// ==================== FlexibleRolloutStrategy ====================

describe('FlexibleRolloutStrategy', () => {
  const strategy = new FlexibleRolloutStrategy();

  it('should have name "flexibleRollout"', () => {
    expect(strategy.name).toBe('flexibleRollout');
  });

  it('should enable at 100% rollout', () => {
    expect(
      strategy.isEnabled(
        { rollout: 100, stickiness: 'userId' },
        { ...defaultContext, userId: 'user-1' }
      )
    ).toBe(true);
  });

  it('should disable at 0% rollout', () => {
    expect(
      strategy.isEnabled(
        { rollout: 0, stickiness: 'userId' },
        { ...defaultContext, userId: 'user-1' }
      )
    ).toBe(false);
  });

  it('should return false when no stickiness value available', () => {
    expect(strategy.isEnabled({ rollout: 50, stickiness: 'userId' }, defaultContext)).toBe(false);
  });

  it('should use default stickiness (userId -> sessionId -> undefined)', () => {
    expect(
      strategy.isEnabled(
        { rollout: 100, stickiness: 'default' },
        { ...defaultContext, sessionId: 'session-1' }
      )
    ).toBe(true);
  });

  it('should use random stickiness', () => {
    // At 100% random should always pass
    expect(strategy.isEnabled({ rollout: 100, stickiness: 'random' }, defaultContext)).toBe(true);
  });

  it('should use custom stickiness from properties', () => {
    expect(
      strategy.isEnabled(
        { rollout: 100, stickiness: 'customField' },
        { ...defaultContext, properties: { customField: 'some-value' } }
      )
    ).toBe(true);
  });

  it('should return detailed result with rollout info', () => {
    const result = strategy.isEnabledWithDetails(
      { rollout: 50, stickiness: 'userId', groupId: 'test-group' },
      { ...defaultContext, userId: 'user-1' }
    );
    expect(result.reason).toContain('Rollout');
    expect(result.details).toBeDefined();
    expect(result.details?.stickiness).toBe('userId');
    expect(result.details?.rollout).toBe(50);
    expect(result.details?.groupId).toBe('test-group');
  });

  it('should produce consistent results for same userId/groupId', () => {
    const params: StrategyParameters = { rollout: 50, stickiness: 'userId', groupId: 'test' };
    const ctx: EvaluationContext = { ...defaultContext, userId: 'consistent-user' };
    const result1 = strategy.isEnabled(params, ctx);
    const result2 = strategy.isEnabled(params, ctx);
    expect(result1).toBe(result2);
  });
});

// ==================== UserWithIdStrategy ====================

describe('UserWithIdStrategy', () => {
  const strategy = new UserWithIdStrategy();

  it('should have name "userWithId"', () => {
    expect(strategy.name).toBe('userWithId');
  });

  it('should match userId in list', () => {
    expect(
      strategy.isEnabled(
        { userIds: 'user-1,user-2,user-3' },
        { ...defaultContext, userId: 'user-2' }
      )
    ).toBe(true);
  });

  it('should not match userId not in list', () => {
    expect(
      strategy.isEnabled(
        { userIds: 'user-1,user-2,user-3' },
        { ...defaultContext, userId: 'user-4' }
      )
    ).toBe(false);
  });

  it('should handle whitespace in comma-separated list', () => {
    expect(
      strategy.isEnabled(
        { userIds: 'user-1, user-2, user-3' },
        { ...defaultContext, userId: 'user-2' }
      )
    ).toBe(true);
  });

  it('should return false when no userIds defined', () => {
    expect(strategy.isEnabled({}, { ...defaultContext, userId: 'user-1' })).toBe(false);
  });

  it('should return false when no userId in context', () => {
    expect(strategy.isEnabled({ userIds: 'user-1,user-2' }, defaultContext)).toBe(false);
  });

  it('should return detailed result', () => {
    const result = strategy.isEnabledWithDetails(
      { userIds: 'user-1,user-2' },
      { ...defaultContext, userId: 'user-1' }
    );
    expect(result.enabled).toBe(true);
    expect(result.reason).toContain('user-1');
    expect(result.reason).toContain('found');
  });

  it('should return detailed failure reason', () => {
    const result = strategy.isEnabledWithDetails(
      { userIds: 'user-1,user-2' },
      { ...defaultContext, userId: 'user-3' }
    );
    expect(result.enabled).toBe(false);
    expect(result.reason).toContain('user-3');
    expect(result.reason).toContain('not in list');
  });
});

// ==================== GradualRolloutUserIdStrategy ====================

describe('GradualRolloutUserIdStrategy', () => {
  const strategy = new GradualRolloutUserIdStrategy();

  it('should have name "gradualRolloutUserId"', () => {
    expect(strategy.name).toBe('gradualRolloutUserId');
  });

  it('should enable at 100% percentage', () => {
    expect(strategy.isEnabled({ percentage: 100 }, { ...defaultContext, userId: 'user-1' })).toBe(
      true
    );
  });

  it('should disable at 0% percentage', () => {
    expect(strategy.isEnabled({ percentage: 0 }, { ...defaultContext, userId: 'user-1' })).toBe(
      false
    );
  });

  it('should return false when no userId in context', () => {
    expect(strategy.isEnabled({ percentage: 50 }, defaultContext)).toBe(false);
  });

  it('should produce consistent results for same userId', () => {
    const params: StrategyParameters = { percentage: 50, groupId: 'test' };
    const ctx: EvaluationContext = { ...defaultContext, userId: 'stable-user' };
    const result1 = strategy.isEnabled(params, ctx);
    const result2 = strategy.isEnabled(params, ctx);
    expect(result1).toBe(result2);
  });

  it('should return detailed result with normalized value', () => {
    const result = strategy.isEnabledWithDetails(
      { percentage: 50 },
      { ...defaultContext, userId: 'user-1' }
    );
    expect(result.details?.userId).toBe('user-1');
    expect(result.details?.percentage).toBe(50);
    expect(typeof result.details?.normalizedValue).toBe('number');
  });
});

// ==================== GradualRolloutRandomStrategy ====================

describe('GradualRolloutRandomStrategy', () => {
  const strategy = new GradualRolloutRandomStrategy();

  it('should have name "gradualRolloutRandom"', () => {
    expect(strategy.name).toBe('gradualRolloutRandom');
  });

  it('should always enable at 100% percentage', () => {
    for (let i = 0; i < 10; i++) {
      expect(strategy.isEnabled({ percentage: 100 }, defaultContext)).toBe(true);
    }
  });

  it('should always disable at 0% percentage', () => {
    for (let i = 0; i < 10; i++) {
      expect(strategy.isEnabled({ percentage: 0 }, defaultContext)).toBe(false);
    }
  });

  it('should return detailed result with random value', () => {
    const result = strategy.isEnabledWithDetails({ percentage: 50 }, defaultContext);
    expect(result.details?.percentage).toBe(50);
    expect(typeof result.details?.random).toBe('number');
  });
});

// ==================== GradualRolloutSessionIdStrategy ====================

describe('GradualRolloutSessionIdStrategy', () => {
  const strategy = new GradualRolloutSessionIdStrategy();

  it('should have name "gradualRolloutSessionId"', () => {
    expect(strategy.name).toBe('gradualRolloutSessionId');
  });

  it('should enable at 100% percentage', () => {
    expect(
      strategy.isEnabled({ percentage: 100 }, { ...defaultContext, sessionId: 'session-1' })
    ).toBe(true);
  });

  it('should disable at 0% percentage', () => {
    expect(
      strategy.isEnabled({ percentage: 0 }, { ...defaultContext, sessionId: 'session-1' })
    ).toBe(false);
  });

  it('should return false when no sessionId in context', () => {
    expect(strategy.isEnabled({ percentage: 50 }, defaultContext)).toBe(false);
  });

  it('should produce consistent results for same sessionId', () => {
    const params: StrategyParameters = { percentage: 50, groupId: 'test' };
    const ctx: EvaluationContext = { ...defaultContext, sessionId: 'stable-session' };
    const result1 = strategy.isEnabled(params, ctx);
    const result2 = strategy.isEnabled(params, ctx);
    expect(result1).toBe(result2);
  });
});

// ==================== RemoteAddressStrategy ====================

describe('RemoteAddressStrategy', () => {
  const strategy = new RemoteAddressStrategy();

  it('should have name "remoteAddress"', () => {
    expect(strategy.name).toBe('remoteAddress');
  });

  it('should match exact IP', () => {
    expect(
      strategy.isEnabled(
        { IPs: '192.168.1.1' },
        { ...defaultContext, remoteAddress: '192.168.1.1' }
      )
    ).toBe(true);
  });

  it('should not match different IP', () => {
    expect(
      strategy.isEnabled({ IPs: '192.168.1.1' }, { ...defaultContext, remoteAddress: '10.0.0.1' })
    ).toBe(false);
  });

  it('should match CIDR range', () => {
    expect(
      strategy.isEnabled(
        { IPs: '192.168.1.0/24' },
        { ...defaultContext, remoteAddress: '192.168.1.100' }
      )
    ).toBe(true);
  });

  it('should not match outside CIDR range', () => {
    expect(
      strategy.isEnabled(
        { IPs: '192.168.1.0/24' },
        { ...defaultContext, remoteAddress: '192.168.2.1' }
      )
    ).toBe(false);
  });

  it('should match in comma-separated list', () => {
    expect(
      strategy.isEnabled(
        { IPs: '10.0.0.1, 192.168.1.0/24, 172.16.0.0/12' },
        { ...defaultContext, remoteAddress: '172.20.5.10' }
      )
    ).toBe(true);
  });

  it('should return false when no IPs defined', () => {
    expect(strategy.isEnabled({}, { ...defaultContext, remoteAddress: '1.2.3.4' })).toBe(false);
  });

  it('should return false when no remoteAddress in context', () => {
    expect(strategy.isEnabled({ IPs: '1.2.3.4' }, defaultContext)).toBe(false);
  });

  it('should match /32 CIDR (single host)', () => {
    expect(
      strategy.isEnabled({ IPs: '10.0.0.5/32' }, { ...defaultContext, remoteAddress: '10.0.0.5' })
    ).toBe(true);
  });

  it('should return detailed result with matched range', () => {
    const result = strategy.isEnabledWithDetails(
      { IPs: '10.0.0.1, 192.168.1.0/24' },
      { ...defaultContext, remoteAddress: '192.168.1.50' }
    );
    expect(result.enabled).toBe(true);
    expect(result.details?.matchedRange).toBe('192.168.1.0/24');
  });
});

// ==================== ApplicationHostnameStrategy ====================

describe('ApplicationHostnameStrategy', () => {
  const strategy = new ApplicationHostnameStrategy();

  it('should have name "applicationHostname"', () => {
    expect(strategy.name).toBe('applicationHostname');
  });

  it('should return false when no hostNames defined', () => {
    expect(strategy.isEnabled({}, defaultContext)).toBe(false);
  });

  it('should return detailed result', () => {
    const result = strategy.isEnabledWithDetails({ hostNames: 'some-host' }, defaultContext);
    expect(result.details?.currentHostname).toBeTruthy();
    expect(result.details?.hostList).toBeDefined();
  });
});

// ==================== normalizedStrategyValue ====================

describe('normalizedStrategyValue', () => {
  it('should return value between 1 and 100', () => {
    for (let i = 0; i < 100; i++) {
      const value = normalizedStrategyValue(`user-${i}`, 'group');
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(100);
    }
  });

  it('should return consistent values', () => {
    const value1 = normalizedStrategyValue('user-123', 'group-a');
    const value2 = normalizedStrategyValue('user-123', 'group-a');
    expect(value1).toBe(value2);
  });

  it('should return different values for different inputs', () => {
    const value1 = normalizedStrategyValue('user-1', 'group-a');
    const value2 = normalizedStrategyValue('user-2', 'group-a');
    // Not guaranteed to be different, but statistically very likely
    // Test with enough variance
    const values = new Set<number>();
    for (let i = 0; i < 50; i++) {
      values.add(normalizedStrategyValue(`user-${i}`, 'test'));
    }
    expect(values.size).toBeGreaterThan(1);
  });
});

// ==================== Strategy Registry ====================

describe('Strategy Registry', () => {
  it('should find all built-in strategies', () => {
    const names = [
      'default',
      'flexibleRollout',
      'userWithId',
      'gradualRolloutUserId',
      'gradualRolloutRandom',
      'gradualRolloutSessionId',
      'remoteAddress',
      'applicationHostname',
    ];
    for (const name of names) {
      expect(getStrategy(name)).toBeDefined();
    }
  });

  it('should return undefined for unknown strategy', () => {
    expect(getStrategy('nonExistentStrategy')).toBeUndefined();
  });

  it('should return strategyFound=false for unknown strategy', () => {
    const result = evaluateStrategyWithDetails('unknown', {}, defaultContext);
    expect(result.strategyFound).toBe(false);
    expect(result.enabled).toBe(false);
  });

  it('should evaluate default strategy correctly', () => {
    const result = evaluateStrategyWithDetails('default', {}, defaultContext);
    expect(result.strategyFound).toBe(true);
    expect(result.enabled).toBe(true);
  });

  it('should evaluate userWithId strategy correctly', () => {
    const result = evaluateStrategyWithDetails(
      'userWithId',
      { userIds: 'a,b,c' },
      { ...defaultContext, userId: 'b' }
    );
    expect(result.strategyFound).toBe(true);
    expect(result.enabled).toBe(true);
    expect(result.reason).toContain('found');
  });
});
