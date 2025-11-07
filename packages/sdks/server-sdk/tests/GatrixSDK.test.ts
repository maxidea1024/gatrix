import { GatrixSDK } from '../src/GatrixSDK';

describe('GatrixSDK', () => {
  describe('constructor', () => {
    it('should create an instance with valid configuration', () => {
      const sdk = new GatrixSDK({
        gatrixUrl: 'http://localhost:3000',
        apiToken: 'test-token',
        applicationName: 'test-app',
      });

      expect(sdk).toBeInstanceOf(GatrixSDK);
    });

    it('should throw error when gatrixUrl is missing', () => {
      expect(() => {
        new GatrixSDK({
          gatrixUrl: '',
          apiToken: 'test-token',
          applicationName: 'test-app',
        });
      }).toThrow('gatrixUrl is required');
    });

    it('should throw error when apiToken is missing', () => {
      expect(() => {
        new GatrixSDK({
          gatrixUrl: 'http://localhost:3000',
          apiToken: '',
          applicationName: 'test-app',
        });
      }).toThrow('apiToken is required');
    });

    it('should throw error when applicationName is missing', () => {
      expect(() => {
        new GatrixSDK({
          gatrixUrl: 'http://localhost:3000',
          apiToken: 'test-token',
          applicationName: '',
        });
      }).toThrow('applicationName is required');
    });
  });

  describe('configuration', () => {
    it('should accept optional cache configuration', () => {
      const sdk = new GatrixSDK({
        gatrixUrl: 'http://localhost:3000',
        apiToken: 'test-token',
        applicationName: 'test-app',
        cache: {
          enabled: true,
          ttl: 300,
        },
      });

      expect(sdk).toBeInstanceOf(GatrixSDK);
    });

    it('should accept optional redis configuration', () => {
      const sdk = new GatrixSDK({
        gatrixUrl: 'http://localhost:3000',
        apiToken: 'test-token',
        applicationName: 'test-app',
        redis: {
          host: 'localhost',
          port: 6379,
        },
      });

      expect(sdk).toBeInstanceOf(GatrixSDK);
    });

    it('should accept optional service discovery configuration', () => {
      const sdk = new GatrixSDK({
        gatrixUrl: 'http://localhost:3000',
        apiToken: 'test-token',
        applicationName: 'test-app',
        etcd: {
          hosts: 'localhost:2379',
        },
        serviceDiscovery: {
          enabled: true,
          mode: 'etcd',
          ttlSeconds: 30,
        },
      });

      expect(sdk).toBeInstanceOf(GatrixSDK);
    });
  });
});

