/**
 * Single Test Server for Service Discovery Testing
 *
 * Starts a single lobbyd server for testing purposes
 */

import { GatrixServerSDK } from '../src';
import chalk from 'chalk';

const GATRIX_URL = process.env.GATRIX_URL || 'http://localhost:45000';
const API_TOKEN = 'unsecured-server-api-token';

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
    apiUrl: GATRIX_URL,
    applicationName: 'test-server',
    apiToken: API_TOKEN,
  });

  let instanceId: string | null = null;

  try {
    // Register service
    const result = await sdk.serviceDiscovery.register({
      labels: {
        service: type,
        group: worldId || 'default',
        ...labels,
      },
      hostname: `${type}-test`,
      ports: {
        internalApi: port,
        externalApi: port,
      },
      meta: {
        version: '1.0.0',
      },
    });

    instanceId = result.instanceId;
    const { externalAddress } = result;

    console.log(chalk.green(`✅ Service registered via API`));
    console.log(chalk.blue(`   Instance ID: ${instanceId}`));
    console.log(chalk.blue(`   External Address: ${externalAddress}`));

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
      });
      console.log(chalk.gray(`📊 Stats updated`));
    }, 10000);

    // Store SDK for graceful shutdown
    (global as any).sdk = sdk;
    (global as any).instanceId = instanceId;
  } catch (error) {
    console.error(chalk.red(`❌ Failed to start server:`), error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log(chalk.yellow('\n\n🛑 Shutting down server...'));
  const sdk = (global as any).sdk;
  const instanceId = (global as any).instanceId;
  const statsInterval = (global as any).statsInterval;

  // Clear stats interval first
  if (statsInterval) {
    clearInterval(statsInterval);
    console.log(chalk.gray(`⏹️  Stats interval cleared`));
  }

  if (sdk && instanceId) {
    try {
      await sdk.serviceDiscovery.unregister();
      console.log(chalk.green(`✅ Service unregistered`));
    } catch (error) {
      console.error(chalk.red(`❌ Failed to unregister service:`), error);
    }
  }

  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log(chalk.yellow('\n\n🛑 Shutting down server...'));
  const sdk = (global as any).sdk;
  const instanceId = (global as any).instanceId;
  const statsInterval = (global as any).statsInterval;

  // Clear stats interval first
  if (statsInterval) {
    clearInterval(statsInterval);
    console.log(chalk.gray(`⏹️  Stats interval cleared`));
  }

  if (sdk && instanceId) {
    try {
      await sdk.serviceDiscovery.unregister();
      console.log(chalk.green(`✅ Service unregistered`));
    } catch (error) {
      console.error(chalk.red(`❌ Failed to unregister service:`), error);
    }
  }

  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error(chalk.red('❌ Uncaught exception:'), error);
  process.exit(1);
});

// Start the server
startServer().catch((error) => {
  console.error(chalk.red('Failed to start server:'), error);
  process.exit(1);
});
