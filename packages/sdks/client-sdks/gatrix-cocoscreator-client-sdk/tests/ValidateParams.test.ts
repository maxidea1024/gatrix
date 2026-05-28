import { validateAll, ValidationRule } from '../src/validate-params';
import { GatrixFeatureError, GatrixFeatureErrorCode } from '../src/errors';

describe('validateAll', () => {
  it('should pass with valid required parameter', () => {
    const rules: ValidationRule[] = [
      { param: 'name', value: 'test', type: 'required' },
    ];
    expect(() => validateAll(rules)).not.toThrow();
  });

  it('should throw for null required parameter', () => {
    const rules: ValidationRule[] = [
      { param: 'name', value: null, type: 'required' },
    ];
    expect(() => validateAll(rules)).toThrow(GatrixFeatureError);
    try {
      validateAll(rules);
    } catch (e: any) {
      expect(e.code).toBe(GatrixFeatureErrorCode.INVALID_PARAMETERS);
    }
  });

  it('should validate string type', () => {
    expect(() =>
      validateAll([{ param: 'name', value: 'valid', type: 'string' }])
    ).not.toThrow();
    expect(() =>
      validateAll([{ param: 'name', value: '', type: 'string' }])
    ).toThrow();
    expect(() =>
      validateAll([{ param: 'name', value: '  ', type: 'string' }])
    ).toThrow();
    expect(() =>
      validateAll([{ param: 'name', value: 123, type: 'string' }])
    ).toThrow();
    expect(() =>
      validateAll([{ param: 'name', value: null, type: 'string' }])
    ).toThrow();
  });

  it('should validate number type', () => {
    expect(() =>
      validateAll([{ param: 'count', value: 42, type: 'number' }])
    ).not.toThrow();
    expect(() =>
      validateAll([{ param: 'count', value: 0, type: 'number' }])
    ).not.toThrow();
    expect(() =>
      validateAll([{ param: 'count', value: NaN, type: 'number' }])
    ).toThrow();
    expect(() =>
      validateAll([{ param: 'count', value: 'not-a-number', type: 'number' }])
    ).toThrow();
    expect(() =>
      validateAll([{ param: 'count', value: null, type: 'number' }])
    ).toThrow();
  });

  it('should validate boolean type', () => {
    expect(() =>
      validateAll([{ param: 'flag', value: true, type: 'boolean' }])
    ).not.toThrow();
    expect(() =>
      validateAll([{ param: 'flag', value: false, type: 'boolean' }])
    ).not.toThrow();
    expect(() =>
      validateAll([{ param: 'flag', value: 'true', type: 'boolean' }])
    ).toThrow();
    expect(() =>
      validateAll([{ param: 'flag', value: null, type: 'boolean' }])
    ).toThrow();
  });

  it('should validate array type', () => {
    expect(() =>
      validateAll([{ param: 'items', value: [1, 2], type: 'array' }])
    ).not.toThrow();
    expect(() =>
      validateAll([{ param: 'items', value: [], type: 'array' }])
    ).toThrow();
    expect(() =>
      validateAll([{ param: 'items', value: 'not-array', type: 'array' }])
    ).toThrow();
    expect(() =>
      validateAll([{ param: 'items', value: null, type: 'array' }])
    ).toThrow();
  });

  it('should aggregate multiple errors into one', () => {
    const rules: ValidationRule[] = [
      { param: 'a', value: null, type: 'required' },
      { param: 'b', value: null, type: 'string' },
      { param: 'c', value: NaN, type: 'number' },
    ];
    try {
      validateAll(rules);
      fail('Expected to throw');
    } catch (e: any) {
      expect(e.message).toContain("'a'");
      expect(e.message).toContain("'b'");
      expect(e.message).toContain("'c'");
    }
  });
});
