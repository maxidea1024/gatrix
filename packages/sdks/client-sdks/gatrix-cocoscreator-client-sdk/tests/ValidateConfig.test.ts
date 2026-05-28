import { validateConfig } from '../src/validate-config';
import { GatrixError } from '../src/errors';
import { GatrixClientConfig } from '../src/types';

const validConfig: GatrixClientConfig = {
  apiUrl: 'https://api.example.com/api/v1',
  apiToken: 'test-token',
  appName: 'testApp',
};

describe('validateConfig', () => {
  it('should accept valid config', () => {
    expect(() => validateConfig(validConfig)).not.toThrow();
  });

  describe('required fields', () => {
    it('should throw if apiUrl is missing', () => {
      expect(() => validateConfig({ ...validConfig, apiUrl: '' })).toThrow(
        GatrixError
      );
    });

    it('should throw if apiToken is missing', () => {
      expect(() => validateConfig({ ...validConfig, apiToken: '' })).toThrow(
        GatrixError
      );
    });

    it('should throw if appName is missing', () => {
      expect(() => validateConfig({ ...validConfig, appName: '' })).toThrow(
        GatrixError
      );
    });
  });

  describe('apiUrl validation', () => {
    it('should reject invalid URL format', () => {
      expect(() =>
        validateConfig({ ...validConfig, apiUrl: 'not-a-url' })
      ).toThrow(GatrixError);
    });

    it('should accept http and https URLs', () => {
      expect(() =>
        validateConfig({ ...validConfig, apiUrl: 'http://localhost:3000' })
      ).not.toThrow();
      expect(() =>
        validateConfig({ ...validConfig, apiUrl: 'https://api.example.com' })
      ).not.toThrow();
    });

    it('should reject apiUrl with leading/trailing whitespace', () => {
      expect(() =>
        validateConfig({ ...validConfig, apiUrl: ' https://api.example.com' })
      ).toThrow(GatrixError);
    });
  });

  describe('features config', () => {
    it('should accept valid refreshInterval', () => {
      expect(() =>
        validateConfig({ ...validConfig, features: { refreshInterval: 30 } })
      ).not.toThrow();
    });

    it('should reject refreshInterval < 1', () => {
      expect(() =>
        validateConfig({ ...validConfig, features: { refreshInterval: 0 } })
      ).toThrow(GatrixError);
    });

    it('should reject refreshInterval > 86400', () => {
      expect(() =>
        validateConfig({
          ...validConfig,
          features: { refreshInterval: 100000 },
        })
      ).toThrow(GatrixError);
    });

    it('should accept valid metricsInterval', () => {
      expect(() =>
        validateConfig({ ...validConfig, features: { metricsInterval: 60 } })
      ).not.toThrow();
    });
  });

  describe('streaming config', () => {
    it('should accept websocket transport', () => {
      expect(() =>
        validateConfig({
          ...validConfig,
          features: { streaming: { transport: 'websocket' } },
        })
      ).not.toThrow();
    });

    it('should reject non-websocket transport in CocosCreator', () => {
      expect(() =>
        validateConfig({
          ...validConfig,
          features: { streaming: { transport: 'sse' as any } },
        })
      ).toThrow(GatrixError);
    });

    it('should accept valid websocket config', () => {
      expect(() =>
        validateConfig({
          ...validConfig,
          features: {
            streaming: {
              websocket: {
                reconnectBase: 1,
                reconnectMax: 30,
                pingInterval: 30,
              },
            },
          },
        })
      ).not.toThrow();
    });

    it('should reject reconnectBase > reconnectMax', () => {
      expect(() =>
        validateConfig({
          ...validConfig,
          features: {
            streaming: {
              websocket: { reconnectBase: 60, reconnectMax: 10 },
            },
          },
        })
      ).toThrow(GatrixError);
    });
  });

  describe('fetchRetryOptions', () => {
    it('should accept valid fetchRetryOptions', () => {
      expect(() =>
        validateConfig({
          ...validConfig,
          features: {
            fetchRetryOptions: {
              timeout: 30000,
              initialBackoff: 1,
              maxBackoff: 60,
              nonRetryableStatusCodes: [401, 403],
            },
          },
        })
      ).not.toThrow();
    });

    it('should reject initialBackoff > maxBackoff', () => {
      expect(() =>
        validateConfig({
          ...validConfig,
          features: {
            fetchRetryOptions: { initialBackoff: 100, maxBackoff: 10 },
          },
        })
      ).toThrow(GatrixError);
    });

    it('should reject invalid nonRetryableStatusCodes', () => {
      expect(() =>
        validateConfig({
          ...validConfig,
          features: {
            fetchRetryOptions: { nonRetryableStatusCodes: [200] },
          },
        })
      ).toThrow(GatrixError);
    });
  });
});
