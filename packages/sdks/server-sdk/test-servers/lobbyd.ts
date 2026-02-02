/**
 * Lobby Server Test
 *
 * Simulates a lobby server that manages game lobbies
 * Demonstrates maintenance event handling and grace period kick functionality
 */

import { BaseTestServer, BaseServerConfig } from "./base-server";

interface Player {
  id: string;
  name: string;
  connectedAt: Date;
}

interface Lobby {
  worldId: string;
  worldName: string;
  players: Player[];
  createdAt: Date;
}

class LobbyServer extends BaseTestServer {
  private lobbies: Map<string, Lobby> = new Map();
  private connectedPlayers: Map<string, Player> = new Map();

  protected async onStart(): Promise<void> {
    this.log("Lobby server specific initialization");

    // Check game worlds for lobby creation
    const worlds = await this.sdk.fetchGameWorlds();
    this.log(`Available game worlds for lobbies: ${worlds.length}`);

    // Subscribe to maintenance events
    this.setupMaintenanceEventHandlers();

    // Simulate player connections
    this.simulatePlayerConnections();

    // Simulate lobby creation/management
    setInterval(() => {
      this.manageLobby();
    }, 20000);
  }

  /**
   * Setup maintenance event handlers
   * Demonstrates how to handle maintenance events and kick players when grace period expires
   */
  private setupMaintenanceEventHandlers(): void {
    // Handle maintenance started event
    this.sdk.on("local.maintenance.started", (event) => {
      const { source, worldId, actualStartTime, details } = event.data;
      this.log(
        `🔧 Maintenance started: source=${source}, worldId=${worldId || "N/A"}`,
      );
      this.log(`   actualStartTime=${actualStartTime}`);
      this.log(
        `   forceDisconnect=${details?.forceDisconnect}, gracePeriodMinutes=${details?.gracePeriodMinutes}`,
      );

      // Notify connected players about maintenance
      this.notifyPlayersAboutMaintenance(source, worldId, details);
    });

    // Handle maintenance ended event
    this.sdk.on("local.maintenance.ended", (event) => {
      const { source, worldId } = event.data;
      this.log(
        `✅ Maintenance ended: source=${source}, worldId=${worldId || "N/A"}`,
      );
    });

    // Handle maintenance updated event
    this.sdk.on("local.maintenance.updated", (event) => {
      const { source, worldId, details } = event.data;
      this.log(
        `📝 Maintenance updated: source=${source}, worldId=${worldId || "N/A"}`,
      );
      this.log(`   New details: ${JSON.stringify(details)}`);
    });

    // Handle grace period expired event - THIS IS WHERE WE KICK PLAYERS
    this.sdk.on("local.maintenance.grace_period_expired", (event) => {
      const { source, worldId, actualStartTime, details } = event.data;
      this.log(
        `⏰ Grace period expired! source=${source}, worldId=${worldId || "N/A"}`,
      );
      this.log(`   Maintenance started at: ${actualStartTime}`);

      // Kick all connected players
      this.kickPlayersForMaintenance(source, worldId, details?.message);
    });
  }

  /**
   * Notify players about upcoming maintenance
   */
  private notifyPlayersAboutMaintenance(
    source: string,
    worldId: string | undefined,
    details:
      | {
          forceDisconnect?: boolean;
          gracePeriodMinutes?: number;
          message?: string;
        }
      | undefined,
  ): void {
    const gracePeriodMinutes = details?.gracePeriodMinutes ?? 0;
    const message = details?.message || "Server maintenance in progress";

    if (source === "service") {
      // Service-level maintenance - notify all players
      this.log(
        `📢 Notifying ${this.connectedPlayers.size} players about service maintenance`,
      );
      for (const [playerId, player] of this.connectedPlayers) {
        this.log(
          `   -> Sending maintenance notice to player ${player.name} (${playerId})`,
        );
        this.log(`      Message: "${message}"`);
        if (details?.forceDisconnect) {
          this.log(
            `      ⚠️ Will be disconnected in ${gracePeriodMinutes} minutes`,
          );
        }
      }
    } else if (source === "world" && worldId) {
      // World-level maintenance - notify players in that world's lobbies
      for (const [lobbyId, lobby] of this.lobbies) {
        if (lobby.worldId === worldId) {
          this.log(
            `📢 Notifying ${lobby.players.length} players in lobby ${lobbyId} about world maintenance`,
          );
          for (const player of lobby.players) {
            this.log(
              `   -> Sending maintenance notice to player ${player.name}`,
            );
          }
        }
      }
    }
  }

  /**
   * Kick players when grace period expires
   * This is called when local.maintenance.grace_period_expired event is received
   */
  private kickPlayersForMaintenance(
    source: string,
    worldId: string | undefined,
    message?: string,
  ): void {
    const kickMessage = message || "Disconnected due to server maintenance";

    if (source === "service") {
      // Service-level maintenance - kick all players
      this.log(
        `🚫 Kicking all ${this.connectedPlayers.size} players due to service maintenance`,
      );
      for (const [playerId, player] of this.connectedPlayers) {
        this.disconnectPlayer(playerId, kickMessage);
      }
      // Clear all lobbies
      this.lobbies.clear();
      this.log(`   All lobbies cleared`);
    } else if (source === "world" && worldId) {
      // World-level maintenance - kick players in that world's lobbies
      for (const [lobbyId, lobby] of this.lobbies) {
        if (lobby.worldId === worldId) {
          this.log(
            `🚫 Kicking ${lobby.players.length} players from lobby ${lobbyId} (world: ${worldId})`,
          );
          for (const player of lobby.players) {
            this.disconnectPlayer(player.id, kickMessage);
          }
          this.lobbies.delete(lobbyId);
          this.log(`   Lobby ${lobbyId} closed`);
        }
      }
    }
  }

  /**
   * Disconnect a player (simulated)
   */
  private disconnectPlayer(playerId: string, reason: string): void {
    const player = this.connectedPlayers.get(playerId);
    if (player) {
      this.log(
        `   ❌ Disconnecting player ${player.name} (${playerId}): ${reason}`,
      );
      this.connectedPlayers.delete(playerId);
    }
  }

  /**
   * Simulate player connections for testing
   */
  private simulatePlayerConnections(): void {
    // Add some simulated players
    const simulatedPlayers: Player[] = [
      { id: "player_001", name: "Alice", connectedAt: new Date() },
      { id: "player_002", name: "Bob", connectedAt: new Date() },
      { id: "player_003", name: "Charlie", connectedAt: new Date() },
    ];

    for (const player of simulatedPlayers) {
      this.connectedPlayers.set(player.id, player);
    }
    this.log(`Simulated ${simulatedPlayers.length} player connections`);
  }

  protected async onStop(): Promise<void> {
    this.log(
      `Shutting down with ${this.lobbies.size} active lobbies and ${this.connectedPlayers.size} connected players`,
    );
    this.lobbies.clear();
    this.connectedPlayers.clear();
  }

  private async manageLobby(): Promise<void> {
    const worlds = await this.sdk.fetchGameWorlds();

    if (worlds.length === 0) {
      this.log("No game worlds available for lobby creation");
      return;
    }

    // Pick a random world
    const world = worlds[Math.floor(Math.random() * worlds.length)];

    // Check if world is in maintenance
    if (this.sdk.isWorldInMaintenance(world.worldId)) {
      this.log(
        `World ${world.name} is in maintenance, skipping lobby creation`,
      );
      return;
    }

    const lobbyId = `lobby_${Date.now()}`;

    // Assign some random players to the lobby
    const playersInLobby: Player[] = [];
    for (const [playerId, player] of this.connectedPlayers) {
      if (Math.random() > 0.5) {
        playersInLobby.push(player);
      }
    }

    this.lobbies.set(lobbyId, {
      worldId: world.worldId,
      worldName: world.name,
      players: playersInLobby,
      createdAt: new Date(),
    });

    this.log(
      `Created lobby ${lobbyId} for world ${world.name} with ${playersInLobby.length} players (Total lobbies: ${this.lobbies.size})`,
    );

    // Update service stats (only if service discovery is enabled)
    if (this.config.enableServiceDiscovery) {
      this.sdk
        .updateServiceStatus({
          status: "ready",
          stats: {
            activeLobbies: this.lobbies.size,
            connectedPlayers: this.connectedPlayers.size,
          },
        })
        .catch((err) => this.logError("Failed to update service status", err));
    }
  }
}

// Parse command line arguments
const instanceId = process.argv[2] || "1";
const port = parseInt(process.argv[3] || "8002");
const group = process.argv[4] || "production";
const enableDiscovery = process.argv[5] === "true" || false;

const config: BaseServerConfig = {
  serviceType: "lobbyd",
  serviceGroup: group,
  customLabels: {
    env: process.env.NODE_ENV || "development",
    region: "ap-northeast-2",
  },
  instanceName: `lobbyd-${instanceId}`,
  port: port,
  enableServiceDiscovery: enableDiscovery,
  enableCache: true,
  enableEvents: false, // Disabled for testing without redis
};

const server = new LobbyServer(config);

// Start server
server.start().catch((error) => {
  console.error("Failed to start lobby server:", error);
  process.exit(1);
});
