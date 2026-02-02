/**
 * Authentication Server Test
 *
 * Simulates an authentication server
 */

import { BaseTestServer, BaseServerConfig } from "./base-server";

class AuthServer extends BaseTestServer {
  private userSessions: Map<string, any> = new Map();

  protected async onStart(): Promise<void> {
    this.log("Authentication server specific initialization");

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

    this.log(
      `User logged in: ${userId} (Total sessions: ${this.userSessions.size})`,
    );

    // Update service stats (only if service discovery is enabled)
    if (this.config.enableServiceDiscovery) {
      this.sdk
        .updateServiceStatus({
          status: "ready",
          stats: {
            activeSessions: this.userSessions.size,
          },
        })
        .catch((err) => this.logError("Failed to update service status", err));
    }
  }
}

// Parse command line arguments
const instanceId = process.argv[2] || "1";
const port = parseInt(process.argv[3] || "8001");
const group = process.argv[4] || "production";
const enableDiscovery = process.argv[5] === "true" || false;

const config: BaseServerConfig = {
  serviceType: "authd",
  serviceGroup: group,
  customLabels: {
    env: process.env.NODE_ENV || "development",
    region: "ap-northeast-2",
  },
  instanceName: `authd-${instanceId}`,
  port: port,
  enableServiceDiscovery: enableDiscovery,
  enableCache: true,
  enableEvents: false, // Disabled for testing without redis
};

const server = new AuthServer(config);

// Start server
server.start().catch((error) => {
  console.error("Failed to start auth server:", error);
  process.exit(1);
});
