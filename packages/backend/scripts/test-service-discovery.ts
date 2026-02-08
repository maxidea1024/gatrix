/**
 * Service Discovery Test Script with Simulation
 *
 * Spawns dummy servers with realistic behavior simulation:
 * - Random initialization delays
 * - Periodic custom state updates
 * - Random server crashes
 * - Status transitions
 *
 * This script simulates real game servers by directly connecting to etcd/Redis
 * (not using backend API)
 *
 * Usage:
 *   ts-node scripts/test-service-discovery.ts --spawn 5
 *   ts-node scripts/test-service-discovery.ts --spawn 5 --mode etcd
 *   ts-node scripts/test-service-discovery.ts --list
 *   ts-node scripts/test-service-discovery.ts --clear
 *
 * Environment Variables:
 *   SERVICE_DISCOVERY_MODE: redis or etcd (default: redis)
 *   REDIS_HOST: Redis host (default: localhost)
 *   REDIS_PORT: Redis port (default: 6379)
 *   ETCD_HOSTS: etcd hosts (default: http://localhost:2379)
 */

import { ulid } from 'ulid';
import Redis from 'ioredis';

// Configuration
const MODE = process.env.SERVICE_DISCOVERY_MODE || 'redis';
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
const ETCD_HOSTS = process.env.ETCD_HOSTS || 'http://localhost:2379';

// etcd client (optional)
let Etcd3: any;
try {
  Etcd3 = require('etcd3').Etcd3;
} catch (e) {
  // etcd3 is optional
}

const SERVER_TYPES = ['world', 'auth', 'channel', 'chat', 'lobby', 'match'];
const STATUSES = ['initializing', 'ready', 'shutting_down', 'error', 'terminated'] as const;
const DEFAULT_TTL = 30; // seconds
const HEARTBEAT_INTERVAL = 15; // seconds
const INACTIVE_KEEP_TTL = 60; // How long to keep inactive services visible in UI

// Custom state templates
const CUSTOM_STATES = {
  initializing: [
    'Loading configuration...',
    'Connecting to database...',
    'Initializing game world...',
    'Loading resources {{percent}}%',
    'Warming up cache...',
  ],
  ready: [
    'Players: {{count}}/{{max}}',
    'CPU: {{percent}}%',
    'Memory: {{mb}}MB',
    'Active sessions: {{count}}',
    'Idle',
  ],
  shutting_down: [
    'Graceful shutdown in progress...',
    'Saving player data...',
    'Closing connections...',
  ],
  error: [
    'Database connection lost',
    'Out of memory',
    'Critical error detected',
    'Service unavailable',
  ],
};

// Store active servers with simulation data
interface ServicePorts {
  tcp?: number[];
  udp?: number[];
  http?: number[];
}

interface InstanceStats {
  cpuUsage?: number;
  memoryUsage?: number;
  memoryTotal?: number;
}

interface ActiveServer {
  instanceId: string;
  type: string;
  status: (typeof STATUSES)[number];
  hostname: string;
  externalAddress: string;
  internalAddress: string;
  ports: ServicePorts;
  instanceStats?: InstanceStats;
  meta?: Record<string, any>;
  heartbeatInterval?: NodeJS.Timeout;
  stateUpdateInterval?: NodeJS.Timeout;
  crashTimeout?: NodeJS.Timeout;
  initDelay?: number;
  lifespan?: number;
}

const activeServers: ActiveServer[] = [];
let redisClient: Redis | null = null;
let etcdClient: any = null;

/**
 * Initialize storage client
 */
async function initClient() {
  if (MODE === 'etcd') {
    if (!Etcd3) {
      console.error('❌ etcd3 package not installed. Run: npm install etcd3');
      process.exit(1);
    }
    etcdClient = new Etcd3({ hosts: ETCD_HOSTS.split(',') });
    console.log(`✅ Connected to etcd: ${ETCD_HOSTS}`);
  } else {
    redisClient = new Redis({
      host: REDIS_HOST,
      port: REDIS_PORT,
    });
    console.log(`✅ Connected to Redis: ${REDIS_HOST}:${REDIS_PORT}`);
  }
}

/**
 * Generate random instance stats
 */
function generateInstanceStats(): InstanceStats {
  return {
    cpuUsage: Math.floor(Math.random() * 100),
    memoryUsage: 512 + Math.floor(Math.random() * 1024),
    memoryTotal: 2048 + Math.floor(Math.random() * 2048),
  };
}

/**
 * Generate random meta data
 */
function generateMeta(type: string): Record<string, any> {
  const meta: Record<string, any> = {};

  if (type === 'lobby' || type === 'channel' || type === 'match') {
    meta.userCount = Math.floor(Math.random() * 100);
    meta.maxUsers = 100 + Math.floor(Math.random() * 100);
  }

  if (type === 'channel' || type === 'match') {
    meta.roomCount = Math.floor(Math.random() * 50);
  }

  return meta;
}

/**
 * Generate random server data
 */
function generateServerData(
  status: (typeof STATUSES)[number] = 'initializing',
  internalAddress?: string
) {
  const type = SERVER_TYPES[Math.floor(Math.random() * SERVER_TYPES.length)];
  const hostname = `${type}-server-${Math.floor(Math.random() * 1000)}`;
  const externalAddress = '127.0.0.1';
  const internal = internalAddress || 'localhost';

  const tcpPort = 3000 + Math.floor(Math.random() * 1000);
  const udpPort = 4000 + Math.floor(Math.random() * 1000);
  const httpPort = 8000 + Math.floor(Math.random() * 1000);

  return {
    type,
    hostname,
    externalAddress,
    internalAddress: internal,
    ports: {
      tcp: [tcpPort],
      udp: [udpPort],
      http: [httpPort],
    },
    status,
    instanceStats: generateInstanceStats(),
    meta: generateMeta(type),
  };
}

/**
 * Register service to storage
 */
async function registerToStorage(server: ActiveServer) {
  // etcd uses / separator, Redis uses :
  const key =
    MODE === 'etcd'
      ? `/services/${server.type}/${server.instanceId}`
      : `services:${server.type}:${server.instanceId}`;

  const value = JSON.stringify({
    instanceId: server.instanceId,
    type: server.type,
    hostname: server.hostname,
    externalAddress: server.externalAddress,
    internalAddress: server.internalAddress,
    ports: server.ports,
    status: server.status,
    instanceStats: server.instanceStats,
    meta: server.meta,
    updatedAt: new Date().toISOString(),
  });

  try {
    if (MODE === 'etcd') {
      if (!etcdClient) {
        console.error('❌ etcd client not initialized');
        return;
      }
      const lease = etcdClient.lease(DEFAULT_TTL);
      await lease.put(key).value(value);
    } else if (redisClient) {
      await redisClient.setex(key, DEFAULT_TTL, value);
    }
  } catch (error) {
    console.error(`❌ Failed to register ${server.type}:${server.instanceId}:`, error);
  }
}

/**
 * Update service status in storage
 */
async function updateStatusInStorage(server: ActiveServer) {
  // etcd uses / separator, Redis uses :
  const key =
    MODE === 'etcd'
      ? `/services/${server.type}/${server.instanceId}`
      : `services:${server.type}:${server.instanceId}`;

  // Update stats and meta
  server.instanceStats = generateInstanceStats();
  server.meta = generateMeta(server.type);

  const value = JSON.stringify({
    instanceId: server.instanceId,
    type: server.type,
    hostname: server.hostname,
    externalAddress: server.externalAddress,
    internalAddress: server.internalAddress,
    ports: server.ports,
    status: server.status,
    instanceStats: server.instanceStats,
    meta: server.meta,
    updatedAt: new Date().toISOString(),
  });

  try {
    if (MODE === 'etcd') {
      if (!etcdClient) {
        console.error('❌ etcd client not initialized');
        return;
      }
      const lease = etcdClient.lease(DEFAULT_TTL);
      await lease.put(key).value(value);
    } else if (redisClient) {
      await redisClient.setex(key, DEFAULT_TTL, value);
    }
  } catch (error) {
    console.error(`❌ Failed to update ${server.type}:${server.instanceId}:`, error);
  }
}

/**
 * Send heartbeat (refresh TTL)
 */
async function sendHeartbeat(server: ActiveServer) {
  await updateStatusInStorage(server);
}

/**
 * Unregister service from storage
 */
async function unregisterFromStorage(server: ActiveServer) {
  // etcd uses / separator, Redis uses :
  const key =
    MODE === 'etcd'
      ? `/services/${server.type}/${server.instanceId}`
      : `services:${server.type}:${server.instanceId}`;

  try {
    if (MODE === 'etcd') {
      if (!etcdClient) {
        console.error('❌ etcd client not initialized');
        return;
      }
      await etcdClient.delete().key(key);
    } else if (redisClient) {
      await redisClient.del(key);
    }
  } catch (error) {
    console.error(`❌ Failed to unregister ${server.type}:${server.instanceId}:`, error);
  }
}

/**
 * Register a dummy server with simulation
 */
async function registerServer(
  permanent: boolean = false,
  internalAddress?: string,
  forceLifespan?: number
) {
  try {
    const serverData = generateServerData('initializing', internalAddress);
    const instanceId = ulid();

    // 30% chance of permanent server, or forced permanent
    const isPermanent = permanent || Math.random() < 0.3;
    const lifespan = isPermanent
      ? null
      : forceLifespan || 30000 + Math.floor(Math.random() * 300000); // null = permanent, or 30s-5min

    const server: ActiveServer = {
      instanceId,
      ...serverData,
      initDelay: Math.floor(Math.random() * 5000), // 0-5 seconds
      lifespan: lifespan || undefined,
    };

    // Register to storage
    await registerToStorage(server);
    activeServers.push(server);

    if (isPermanent) {
      console.log(
        `✅ Server registered: ${server.type}:${server.instanceId} (init delay: ${server.initDelay}ms, lifespan: PERMANENT)`
      );
    } else {
      console.log(
        `✅ Server registered: ${server.type}:${server.instanceId} (init delay: ${server.initDelay}ms, lifespan: ${server.lifespan}ms)`
      );
    }

    // Simulate initialization delay
    setTimeout(async () => {
      server.status = 'ready';
      await updateStatusInStorage(server);
      console.log(`🟢 Server ready: ${server.type}:${server.instanceId}`);
    }, server.initDelay);

    // Start heartbeat
    server.heartbeatInterval = setInterval(async () => {
      await sendHeartbeat(server);
    }, HEARTBEAT_INTERVAL * 1000);

    // Periodic state updates
    server.stateUpdateInterval = setInterval(
      async () => {
        if (server.status === 'ready') {
          await updateStatusInStorage(server);
        }
      },
      5000 + Math.floor(Math.random() * 5000)
    ); // 5-10 seconds

    // Schedule crash/shutdown (only for non-permanent servers)
    if (!isPermanent && server.lifespan) {
      server.crashTimeout = setTimeout(async () => {
        const willCrash = Math.random() < 0.3; // 30% crash, 70% graceful shutdown

        if (willCrash) {
          server.status = 'error';
          console.log(`💥 Server crashed: ${server.type}:${server.instanceId}`);
          await updateStatusInStorage(server);

          // Unregister immediately for crashed servers
          setTimeout(async () => {
            await unregisterServer(server.instanceId, server.type);
          }, 2000);
        } else {
          server.status = 'shutting_down';
          console.log(`🔴 Server shutting down: ${server.type}:${server.instanceId}`);
          await updateStatusInStorage(server);

          // Change to terminated after 2 seconds
          setTimeout(async () => {
            server.status = 'terminated';
            console.log(`⚫ Server terminated: ${server.type}:${server.instanceId}`);

            // Update with long TTL (1 hour)
            const key =
              MODE === 'etcd'
                ? `/services/${server.type}/${server.instanceId}`
                : `services:${server.type}:${server.instanceId}`;

            const value = JSON.stringify({
              instanceId: server.instanceId,
              type: server.type,
              hostname: server.hostname,
              externalAddress: server.externalAddress,
              internalAddress: server.internalAddress,
              ports: server.ports,
              status: server.status,
              instanceStats: server.instanceStats,
              meta: server.meta,
              updatedAt: new Date().toISOString(),
            });

            if (MODE === 'etcd') {
              const lease = etcdClient.lease(INACTIVE_KEEP_TTL);
              await lease.put(key).value(value);
            } else if (redisClient) {
              await redisClient.setex(key, INACTIVE_KEEP_TTL, value);
            }

            // Stop heartbeat
            if (server.heartbeatInterval) clearInterval(server.heartbeatInterval);
            if (server.stateUpdateInterval) clearInterval(server.stateUpdateInterval);
          }, 2000);
        }
      }, server.lifespan);
    }

    return server;
  } catch (error: any) {
    console.error('❌ Failed to register server:', error.message);
    throw error;
  }
}

/**
 * Unregister a server
 */
async function unregisterServer(instanceId: string, type: string) {
  const index = activeServers.findIndex((s) => s.instanceId === instanceId && s.type === type);
  if (index === -1) {
    console.error(`❌ Server not found: ${type}:${instanceId}`);
    return;
  }

  const server = activeServers[index];

  // Clear intervals
  if (server.heartbeatInterval) clearInterval(server.heartbeatInterval);
  if (server.stateUpdateInterval) clearInterval(server.stateUpdateInterval);
  if (server.crashTimeout) clearTimeout(server.crashTimeout);

  // Unregister from storage
  await unregisterFromStorage(server);

  activeServers.splice(index, 1);
  console.log(`🗑️  Server unregistered: ${type}:${instanceId}`);
}

/**
 * List all active servers
 */
async function listServers() {
  try {
    if (MODE === 'etcd') {
      if (!etcdClient) {
        console.error('❌ etcd client not initialized');
        return;
      }
      // Get all services from etcd
      const keys = await etcdClient.getAll().prefix('/services/').keys();
      console.log(`\n📋 Active Servers (${keys.length}):\n`);

      for (const key of keys) {
        const value = await etcdClient.get(key).string();
        if (value) {
          const server = JSON.parse(value);
          const tcpPorts = server.ports?.tcp?.join(',') || '';
          console.log(
            `  ${server.type}:${server.instanceId} - ${server.status} - ${server.hostname} (${server.internalAddress}:${tcpPorts})`
          );
        }
      }
    } else if (redisClient) {
      // Get all services from Redis
      const keys = await redisClient.keys('service:instance:*');
      console.log(`\n📋 Active Servers (${keys.length}):\n`);

      for (const key of keys) {
        const value = await redisClient.get(key);
        if (value) {
          const server = JSON.parse(value);
          const tcpPorts = server.ports?.tcp?.join(',') || '';
          console.log(
            `  ${server.type}:${server.instanceId} - ${server.status} - ${server.hostname} (${server.internalAddress}:${tcpPorts})`
          );
        }
      }
    }
    console.log('');
  } catch (error) {
    console.error('❌ Failed to list servers:', error);
  }
}

/**
 * Clear all servers
 */
async function clearAllServers() {
  console.log(`\n🧹 Clearing all servers (${activeServers.length})...\n`);
  const allServers = [...activeServers];
  for (const server of allServers) {
    await unregisterServer(server.instanceId, server.type);
  }
  console.log('✅ All servers cleared\n');
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args.find((arg) => arg.startsWith('--'));
  const count = parseInt(args.find((arg) => !arg.startsWith('--')) || '1', 10);

  // Parse optional lifespan parameters
  let minLifespan: number | undefined;
  let maxLifespan: number | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--min-lifespan' && args[i + 1]) {
      minLifespan = parseInt(args[i + 1], 10);
    } else if (args[i] === '--max-lifespan' && args[i + 1]) {
      maxLifespan = parseInt(args[i + 1], 10);
    }
  }

  console.log('\n🚀 Service Discovery Test Script');
  console.log(`Mode: ${MODE}\n`);

  // Initialize client
  await initClient();

  if (command === '--spawn') {
    console.log(`\nSpawning ${count} dummy servers...\n`);
    if (minLifespan && maxLifespan) {
      console.log(`Lifespan: ${minLifespan}ms - ${maxLifespan}ms\n`);
    }
    for (let i = 0; i < count; i++) {
      let lifespan: number | undefined;
      if (minLifespan && maxLifespan) {
        lifespan = minLifespan + Math.floor(Math.random() * (maxLifespan - minLifespan));
      }
      await registerServer(false, undefined, lifespan);
      // Small delay between spawns
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    console.log(`\n✅ ${count} servers spawned\n`);

    // Keep running
    console.log('Press Ctrl+C to stop and cleanup...\n');

    // Cleanup on exit
    process.on('SIGINT', async () => {
      console.log('\n\n🛑 Shutting down...\n');

      // Unregister all servers
      const allServers = [...activeServers];
      for (const server of allServers) {
        await unregisterServer(server.instanceId, server.type);
      }

      console.log('\n✅ Cleanup complete\n');
      process.exit(0);
    });
  } else if (command === '--list') {
    await listServers();
    process.exit(0);
  } else if (command === '--clear') {
    await clearAllServers();
    process.exit(0);
  } else {
    console.log('Usage:');
    console.log('  ts-node scripts/test-service-discovery.ts --spawn 5');
    console.log('  ts-node scripts/test-service-discovery.ts --list');
    console.log('  ts-node scripts/test-service-discovery.ts --clear');
    console.log('');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
