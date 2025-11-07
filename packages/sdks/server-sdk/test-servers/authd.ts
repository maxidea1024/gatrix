/**
 * Authentication Server Test
 * 
 * Simulates an authentication server
 */

import { BaseTestServer, BaseServerConfig } from './base-server';

class AuthServer extends BaseTestServer {
  private userSessions: Map<string, any> = new Map();

  protected async onStart(): Promise<void> {
    this.log('Authentication server specific initialization');
    
    // Simulate periodic user login
    setInterval(() => {
      this.simulateUserLogin();
    }, 15000);
  }

  protected async onStop(): Promise<void> {
    this.log(`Shutting down with ${this.userSessions.size} active sessions`);
    this.userSessions.clear();
  }

  private simulateUserLogin(): void {
    const userId = `user_${Math.floor(Math.random() * 10000)}`;
    this.userSessions.set(userId, {
      loginTime: new Date(),
      ip: `192.168.1.${Math.floor(Math.random() * 255)}`,
    });

    this.log(`User logged in: ${userId} (Total sessions: ${this.userSessions.size})`);

    // Update service stats
    this.sdk.updateServiceStatus({
      status: 'ready',
      meta: {
        activeSessions: this.userSessions.size,
      },
    }).catch(err => this.logError('Failed to update service status', err));
  }
}

// Parse command line arguments
const instanceId = process.argv[2] || '1';
const port = parseInt(process.argv[3] || '8001');

const config: BaseServerConfig = {
  serverType: 'authd',
  serviceGroup: 'production',
  instanceName: `authd-${instanceId}`,
  port: port,
  enableServiceDiscovery: false, // Disabled for testing without etcd/redis
  enableCache: true,
  enableEvents: false, // Disabled for testing without redis
};

const server = new AuthServer(config);

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nReceived SIGINT, shutting down gracefully...');
  await server.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nReceived SIGTERM, shutting down gracefully...');
  await server.stop();
  process.exit(0);
});

// Start server
server.start().catch((error) => {
  console.error('Failed to start auth server:', error);
  process.exit(1);
});

