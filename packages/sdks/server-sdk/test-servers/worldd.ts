/**
 * World Server Test
 * 
 * Simulates a game world server with full SDK features
 */

import { BaseTestServer, BaseServerConfig } from './base-server';

class WorldServer extends BaseTestServer {
  private players: Map<string, any> = new Map();
  private npcs: number = 0;

  protected async onStart(): Promise<void> {
    this.log('World server specific initialization');
    
    // Initialize NPCs
    this.npcs = Math.floor(Math.random() * 100) + 50;
    this.log(`Initialized with ${this.npcs} NPCs`);

    // Check for popups and surveys
    await this.checkPopupsAndSurveys();

    // Simulate player activity
    setInterval(() => {
      this.simulatePlayerActivity();
    }, 12000);

    // Periodic coupon redemption test
    setInterval(() => {
      this.testCouponRedemption();
    }, 30000);
  }

  protected async onStop(): Promise<void> {
    this.log(`Shutting down with ${this.players.size} active players`);
    this.players.clear();
  }

  private async checkPopupsAndSurveys(): Promise<void> {
    // Check popups for this world
    const popups = await this.sdk.getPopupNotices();
    this.log(`Active popups: ${popups.length}`);

    // Check surveys
    const surveys = await this.sdk.getSurveys();
    this.log(`Active surveys: ${surveys.length}`);
  }

  private simulatePlayerActivity(): void {
    const action = Math.random();

    if (action < 0.5 && this.players.size < 100) {
      // Player join
      const playerId = `player_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
      this.players.set(playerId, {
        joinTime: new Date(),
        level: Math.floor(Math.random() * 100) + 1,
        position: { x: Math.random() * 1000, y: Math.random() * 1000 },
      });
      this.log(`Player joined: ${playerId} (Total: ${this.players.size})`);
    } else if (this.players.size > 0) {
      // Player leave
      const playerIds = Array.from(this.players.keys());
      const playerId = playerIds[Math.floor(Math.random() * playerIds.length)];
      this.players.delete(playerId);
      this.log(`Player left: ${playerId} (Total: ${this.players.size})`);
    }

    // Update service stats
    this.sdk.updateServiceStatus({
      status: 'ready',
      instanceStats: {
        cpuUsage: Math.random() * 100,
        memoryUsage: Math.random() * 2048,
        memoryTotal: 4096,
      },
      meta: {
        activePlayers: this.players.size,
        npcs: this.npcs,
      },
    }).catch(err => this.logError('Failed to update service status', err));
  }

  private async testCouponRedemption(): Promise<void> {
    if (this.players.size === 0) {
      return;
    }

    const playerIds = Array.from(this.players.keys());
    const playerId = playerIds[Math.floor(Math.random() * playerIds.length)];
    const couponCode = `TEST${Math.floor(Math.random() * 10000)}`;

    try {
      this.log(`Testing coupon redemption: ${couponCode} for ${playerId}`);
      const result = await this.sdk.redeemCoupon({
        code: couponCode,
        userId: playerId,
      });
      this.log(`Coupon redeemed successfully: ${JSON.stringify(result)}`);
    } catch (error: any) {
      // Expected to fail with invalid coupon
      this.log(`Coupon redemption failed (expected): ${error.message}`);
    }
  }
}

// Parse command line arguments
const instanceId = process.argv[2] || '1';
const port = parseInt(process.argv[3] || '8004');
const group = process.argv[4] || 'kr-1';

const config: BaseServerConfig = {
  serverType: 'worldd',
  serviceGroup: group,
  instanceName: `worldd-${group}-${instanceId}`,
  port: port,
  enableServiceDiscovery: false, // Disabled for testing without etcd/redis
  enableCache: true,
  enableEvents: false, // Disabled for testing without redis
};

const server = new WorldServer(config);

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
  console.error('Failed to start world server:', error);
  process.exit(1);
});

