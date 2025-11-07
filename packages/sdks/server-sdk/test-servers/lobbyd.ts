/**
 * Lobby Server Test
 * 
 * Simulates a lobby server that manages game lobbies
 */

import { BaseTestServer, BaseServerConfig } from './base-server';

class LobbyServer extends BaseTestServer {
  private lobbies: Map<string, any> = new Map();

  protected async onStart(): Promise<void> {
    this.log('Lobby server specific initialization');
    
    // Check game worlds for lobby creation
    const worlds = await this.sdk.getGameWorlds();
    this.log(`Available game worlds for lobbies: ${worlds.length}`);

    // Simulate lobby creation/management
    setInterval(() => {
      this.manageLobby();
    }, 20000);
  }

  protected async onStop(): Promise<void> {
    this.log(`Shutting down with ${this.lobbies.size} active lobbies`);
    this.lobbies.clear();
  }

  private async manageLobby(): Promise<void> {
    const worlds = await this.sdk.getGameWorlds();
    
    if (worlds.length === 0) {
      this.log('No game worlds available for lobby creation');
      return;
    }

    // Pick a random world
    const world = worlds[Math.floor(Math.random() * worlds.length)];

    // Check if world is in maintenance
    if (this.sdk.isWorldInMaintenance(world.worldId)) {
      this.log(`World ${world.name} is in maintenance, skipping lobby creation`);
      return;
    }

    const lobbyId = `lobby_${Date.now()}`;
    this.lobbies.set(lobbyId, {
      worldId: world.worldId,
      worldName: world.name,
      players: [],
      createdAt: new Date(),
    });

    this.log(`Created lobby ${lobbyId} for world ${world.name} (Total lobbies: ${this.lobbies.size})`);

    // Update service stats (only if service discovery is enabled)
    if (this.config.enableServiceDiscovery) {
      this.sdk.updateServiceStatus({
        status: 'ready',
        meta: {
          activeLobbies: this.lobbies.size,
        },
      }).catch(err => this.logError('Failed to update service status', err));
    }
  }
}

// Parse command line arguments
const instanceId = process.argv[2] || '1';
const port = parseInt(process.argv[3] || '8002');
const group = process.argv[4] || 'production';
const enableDiscovery = process.argv[5] === 'true' || false;

const config: BaseServerConfig = {
  serverType: 'lobbyd',
  serviceGroup: group,
  instanceName: `lobbyd-${instanceId}`,
  port: port,
  enableServiceDiscovery: enableDiscovery,
  enableCache: true,
  enableEvents: false, // Disabled for testing without redis
};

const server = new LobbyServer(config);

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
  console.error('Failed to start lobby server:', error);
  process.exit(1);
});

