import { GatrixFeatureError, GatrixFeatureErrorCode, GatrixError } from '../src/errors';

describe('GatrixError', () => {
  it('should create an error with a message', () => {
    const error = new GatrixError('test message');
    expect(error.message).toBe('test message');
    expect(error.name).toBe('GatrixError');
    expect(error instanceof Error).toBe(true);
  });

  it('should set cause when provided', () => {
    const cause = new Error('root cause');
    const error = new GatrixError('test', { cause });
    expect((error as any).cause).toBe(cause);
  });
});

describe('GatrixFeatureError', () => {
  it('should create error with code and message', () => {
    const error = new GatrixFeatureError(
      GatrixFeatureErrorCode.FLAG_NOT_FOUND,
      'Flag not found'
    );
    expect(error.code).toBe('FLAG_NOT_FOUND');
    expect(error.message).toBe('Flag not found');
    expect(error.name).toBe('GatrixFeatureError');
    expect(error instanceof GatrixError).toBe(true);
  });

  it('should include flagName and details', () => {
    const error = new GatrixFeatureError(
      GatrixFeatureErrorCode.TYPE_MISMATCH,
      'Type mismatch',
      { flagName: 'myFlag', details: { expected: 'boolean', actual: 'string' } }
    );
    expect(error.flagName).toBe('myFlag');
    expect(error.details).toEqual({ expected: 'boolean', actual: 'string' });
  });

  describe('static factory methods', () => {
    it('flagNotFound', () => {
      const error = GatrixFeatureError.flagNotFound('myFlag');
      expect(error.code).toBe(GatrixFeatureErrorCode.FLAG_NOT_FOUND);
      expect(error.flagName).toBe('myFlag');
    });

    it('flagDisabled', () => {
      const error = GatrixFeatureError.flagDisabled('myFlag');
      expect(error.code).toBe(GatrixFeatureErrorCode.FLAG_DISABLED);
      expect(error.flagName).toBe('myFlag');
    });

    it('typeMismatch', () => {
      const error = GatrixFeatureError.typeMismatch('myFlag', 'boolean', 'string');
      expect(error.code).toBe(GatrixFeatureErrorCode.TYPE_MISMATCH);
      expect(error.flagName).toBe('myFlag');
      expect(error.details).toEqual({ expected: 'boolean', actual: 'string' });
    });

    it('noDataAvailable', () => {
      const error = GatrixFeatureError.noDataAvailable();
      expect(error.code).toBe(GatrixFeatureErrorCode.NO_DATA_AVAILABLE);
    });

    it('noValue', () => {
      const error = GatrixFeatureError.noValue('myFlag');
      expect(error.code).toBe(GatrixFeatureErrorCode.NO_VALUE);
      expect(error.flagName).toBe('myFlag');
    });

    it('parseError', () => {
      const cause = new Error('parse failed');
      const error = GatrixFeatureError.parseError('myFlag', cause);
      expect(error.code).toBe(GatrixFeatureErrorCode.PARSE_ERROR);
      expect(error.flagName).toBe('myFlag');
      expect((error as any).cause).toBe(cause);
    });
  });
});
