/**
 * Chat Server Test
 * 
 * Simulates a chat server
 */

import { BaseTestServer, BaseServerConfig } from './base-server';

class ChatServer extends BaseTestServer {
  private channels: Map<string, any> = new Map();
  private messageCount = 0;

  protected async onStart(): Promise<void> {
    this.log('Chat server specific initialization');
    
    // Create default channels
    this.createChannel('global', 'Global Chat');
    this.createChannel('trade', 'Trade Chat');
    this.createChannel('guild', 'Guild Chat');

    // Simulate chat activity
    setInterval(() => {
      this.simulateChatActivity();
    }, 10000);

    // Listen to custom events
    this.sdk.on('chat.broadcast', (data) => {
      this.log(`[CUSTOM EVENT] Broadcast message: ${JSON.stringify(data)}`);
    });
  }

  protected async onStop(): Promise<void> {
    this.log(`Shutting down with ${this.channels.size} channels and ${this.messageCount} total messages`);
    this.channels.clear();
  }

  private createChannel(id: string, name: string): void {
    this.channels.set(id, {
      id,
      name,
      users: new Set(),
      messages: [],
    });
    this.log(`Created channel: ${name}`);
  }

  private simulateChatActivity(): void {
    const channelIds = Array.from(this.channels.keys());
    const channelId = channelIds[Math.floor(Math.random() * channelIds.length)];
    const channel = this.channels.get(channelId);

    if (channel) {
      this.messageCount++;
      channel.messages.push({
        id: this.messageCount,
        user: `user_${Math.floor(Math.random() * 100)}`,
        message: `Test message ${this.messageCount}`,
        timestamp: new Date(),
      });

      this.log(`Message in ${channel.name}: Total ${this.messageCount} messages`);

      // Update service stats (only if service discovery is enabled)
      if (this.config.enableServiceDiscovery) {
        this.sdk.updateServiceStatus({
          status: 'ready',
          meta: {
            totalMessages: this.messageCount,
            activeChannels: this.channels.size,
          },
        }).catch(err => this.logError('Failed to update service status', err));
      }
    }
  }
}

// Parse command line arguments
const instanceId = process.argv[2] || '1';
const port = parseInt(process.argv[3] || '8003');
const group = process.argv[4] || 'production';
const enableDiscovery = process.argv[5] === 'true' || false;

const config: BaseServerConfig = {
  serverType: 'chatd',
  serviceGroup: group,
  instanceName: `chatd-${instanceId}`,
  port: port,
  enableServiceDiscovery: enableDiscovery,
  enableCache: true,
  enableEvents: false, // Disabled for testing without redis
};

const server = new ChatServer(config);

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
  console.error('Failed to start chat server:', error);
  process.exit(1);
});

