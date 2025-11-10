/**
 * Single Test Server for Service Discovery Testing
 * 
 * Starts a single lobbyd server for testing purposes
 */

import { GatrixServerSDK } from '../src';
import chalk from 'chalk';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:55000';
const API_TOKEN = 'gatrix-unsecured-server-api-token';

// Server configuration
const SERVER_CONFIG = {
  type: 'lobbyd',
  port: 8100,
  worldId: null,
  labels: {
    env: 'development',
    region: 'ap-northeast-2',
    role: 'lobby-server',
  },
};

async function startServer() {
  const { type, port, worldId, labels } = SERVER_CONFIG;
  
  console.log(chalk.cyan(`\n🚀 Starting ${type} server on port ${port}...`));

  const sdk = new GatrixServerSDK({
    backendUrl: BACKEND_URL,
    apiToken: API_TOKEN,
  });

  try {
    // Register service
    await sdk.serviceDiscovery.register({
      labels: {
        service: type,
        group: worldId || 'default',
        ...labels,
      },
      hostname: `${type}-test`,
      ports: {
        http: port,
      },
      status: 'starting',
      autoRegisterIfMissing: true,
    });

    console.log(chalk.green(`✅ Service registered via API`));

    // Start heartbeat
    sdk.serviceDiscovery.startHeartbeat(5000); // 5 seconds interval
    console.log(chalk.blue(`💓 Heartbeat started (5s interval)`));

    // Update status to ready after 2 seconds
    setTimeout(async () => {
      await sdk.serviceDiscovery.updateStatus({
        status: 'ready',
        stats: {
          cpuUsage: Math.random() * 100,
          memoryUsage: Math.random() * 1024,
          memoryTotal: 4096,
          activePlayers: Math.floor(Math.random() * 10),
        },
        autoRegisterIfMissing: true,
      });
      console.log(chalk.green(`✅ Status updated to 'ready'`));
    }, 2000);

    // Simulate random stats updates every 10 seconds
    setInterval(async () => {
      await sdk.serviceDiscovery.updateStatus({
        stats: {
          cpuUsage: Math.random() * 100,
          memoryUsage: Math.random() * 1024,
          memoryTotal: 4096,
          activePlayers: Math.floor(Math.random() * 10),
        },
        autoRegisterIfMissing: true,
      });
      console.log(chalk.gray(`📊 Stats updated`));
    }, 10000);

  } catch (error) {
    console.error(chalk.red(`❌ Failed to start server:`), error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log(chalk.yellow('\n\n🛑 Shutting down server...'));
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log(chalk.yellow('\n\n🛑 Shutting down server...'));
  process.exit(0);
});

// Start the server
startServer().catch((error) => {
  console.error(chalk.red('Failed to start server:'), error);
  process.exit(1);
});

