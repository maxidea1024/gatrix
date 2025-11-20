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
    const popups = await this.sdk.fetchPopupNotices();
    this.log(`Active popups: ${popups.length}`);

    // Check surveys (may fail if not available)
    try {
      const surveys = await this.sdk.fetchSurveys();
      this.log(`Active surveys: ${surveys.length}`);
    } catch (error: any) {
      this.log(`Surveys not available: ${error.message}`);
    }
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

    // Update service stats (only if service discovery is enabled)
    if (this.config.enableServiceDiscovery) {
      this.sdk.updateServiceStatus({
        status: 'ready',
        stats: {
          cpuUsage: Math.random() * 100,
          memoryUsage: Math.random() * 2048,
          memoryTotal: 4096,
          activePlayers: this.players.size,
          npcs: this.npcs,
        },
      }).catch(err => this.logError('Failed to update service status', err));
    }
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
        userName: `Player_${playerId}`,
        characterId: `char_${playerId}`,
        worldId: 'world-1',
        platform: 'pc',
        channel: 'steam',
        subChannel: 'global',
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
const enableDiscovery = process.argv[5] === 'true' || false;

const config: BaseServerConfig = {
  serviceType: 'worldd',
  serviceGroup: group,
  customLabels: {
    env: process.env.NODE_ENV || 'development',
    region: 'ap-northeast-2',
    role: 'game-server',
  },
  instanceName: `worldd-${group}-${instanceId}`,
  port: port,
  enableServiceDiscovery: enableDiscovery,
  enableCache: true,
  enableEvents: false, // Disabled for testing without redis
};

const server = new WorldServer(config);



// Start server
server.start().catch((error) => {
  console.error('Failed to start world server:', error);
  process.exit(1);
});

