#!/usr/bin/env ts-node

/**
 * Start 50 SDK test servers for real-time event testing
 * - 25 lobbyd servers (ports 8100-8124)
 * - 25 worldd servers (ports 8200-8224)
 */

import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';

interface ServerProcess {
  type: 'lobbyd' | 'worldd';
  instanceId: number;
  port: number;
  process: ChildProcess;
}

const servers: ServerProcess[] = [];
const LOBBYD_START_PORT = 8100;
const WORLDD_START_PORT = 8200;
const LOBBYD_COUNT = 25;
const WORLDD_COUNT = 25;

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function startLobbyServer(instanceId: number, port: number): ChildProcess {
  const scriptPath = path.join(__dirname, 'lobbyd.ts');

  log(`Starting lobbyd instance ${instanceId} on port ${port}...`, colors.cyan);

  const proc = spawn(
    'npx',
    ['ts-node', scriptPath, instanceId.toString(), port.toString(), 'production', 'true'],
    {
      cwd: path.join(__dirname, '..'),
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    }
  );

  proc.stdout?.on('data', (data) => {
    const output = data.toString().trim();
    if (output) {
      console.log(`${colors.cyan}[lobbyd-${instanceId}:${port}]${colors.reset} ${output}`);
    }
  });

  proc.stderr?.on('data', (data) => {
    const output = data.toString().trim();
    if (output) {
      console.error(`${colors.red}[lobbyd-${instanceId}:${port} ERROR]${colors.reset} ${output}`);
    }
  });

  proc.on('exit', (code) => {
    log(`lobbyd instance ${instanceId} (port ${port}) exited with code ${code}`, colors.yellow);
  });

  return proc;
}

function startWorldServer(instanceId: number, port: number, worldId: string): ChildProcess {
  const scriptPath = path.join(__dirname, 'worldd.ts');

  log(`Starting worldd instance ${instanceId} (${worldId}) on port ${port}...`, colors.magenta);

  const proc = spawn(
    'npx',
    ['ts-node', scriptPath, instanceId.toString(), port.toString(), worldId, 'true'],
    {
      cwd: path.join(__dirname, '..'),
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    }
  );

  proc.stdout?.on('data', (data) => {
    const output = data.toString().trim();
    if (output) {
      console.log(
        `${colors.magenta}[worldd-${instanceId}:${port}:${worldId}]${colors.reset} ${output}`
      );
    }
  });

  proc.stderr?.on('data', (data) => {
    const output = data.toString().trim();
    if (output) {
      console.error(
        `${colors.red}[worldd-${instanceId}:${port}:${worldId} ERROR]${colors.reset} ${output}`
      );
    }
  });

  proc.on('exit', (code) => {
    log(
      `worldd instance ${instanceId} (port ${port}, ${worldId}) exited with code ${code}`,
      colors.yellow
    );
  });

  return proc;
}

async function startAllServers() {
  log('\n========================================', colors.bright);
  log('Starting 50 SDK Test Servers', colors.bright);
  log('========================================\n', colors.bright);

  // Start 25 lobbyd servers
  log(`\n${colors.green}Starting ${LOBBYD_COUNT} lobbyd servers...${colors.reset}\n`);
  for (let i = 0; i < LOBBYD_COUNT; i++) {
    const instanceId = i + 1;
    const port = LOBBYD_START_PORT + i;

    const proc = startLobbyServer(instanceId, port);
    servers.push({
      type: 'lobbyd',
      instanceId,
      port,
      process: proc,
    });

    // Small delay to avoid overwhelming the system
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  log(
    `\n${colors.green}✓ Started ${LOBBYD_COUNT} lobbyd servers (ports ${LOBBYD_START_PORT}-${LOBBYD_START_PORT + LOBBYD_COUNT - 1})${colors.reset}\n`
  );

  // Start 25 worldd servers (distribute across different world IDs)
  log(`\n${colors.green}Starting ${WORLDD_COUNT} worldd servers...${colors.reset}\n`);
  const worldIds = ['kr-1', 'kr-2', 'us-1', 'us-2', 'jp-1'];

  for (let i = 0; i < WORLDD_COUNT; i++) {
    const instanceId = i + 1;
    const port = WORLDD_START_PORT + i;
    const worldId = worldIds[i % worldIds.length]; // Distribute across world IDs

    const proc = startWorldServer(instanceId, port, worldId);
    servers.push({
      type: 'worldd',
      instanceId,
      port,
      process: proc,
    });

    // Small delay to avoid overwhelming the system
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  log(
    `\n${colors.green}✓ Started ${WORLDD_COUNT} worldd servers (ports ${WORLDD_START_PORT}-${WORLDD_START_PORT + WORLDD_COUNT - 1})${colors.reset}\n`
  );

  log('\n========================================', colors.bright);
  log(`Total: ${servers.length} servers running`, colors.bright);
  log('========================================\n', colors.bright);

  log(`${colors.yellow}Press Ctrl+C to stop all servers${colors.reset}\n`);

  // Print summary
  printSummary();
}

function printSummary() {
  const lobbydServers = servers.filter((s) => s.type === 'lobbyd');
  const worlddServers = servers.filter((s) => s.type === 'worldd');

  console.log('\n' + colors.bright + '📊 Server Summary:' + colors.reset);
  console.log(`${colors.cyan}Lobbyd Servers: ${lobbydServers.length}${colors.reset}`);
  console.log(`  Ports: ${LOBBYD_START_PORT}-${LOBBYD_START_PORT + LOBBYD_COUNT - 1}`);
  console.log(`${colors.magenta}Worldd Servers: ${worlddServers.length}${colors.reset}`);
  console.log(`  Ports: ${WORLDD_START_PORT}-${WORLDD_START_PORT + WORLDD_COUNT - 1}`);
  console.log(`  World IDs: kr-1, kr-2, us-1, us-2, jp-1 (distributed)`);
  console.log(`${colors.green}Total: ${servers.length} servers${colors.reset}\n`);
}

function stopAllServers() {
  log('\n\nStopping all servers...', colors.yellow);

  servers.forEach((server) => {
    try {
      server.process.kill('SIGTERM');
      log(`Stopped ${server.type} instance ${server.instanceId} (port ${server.port})`, colors.dim);
    } catch (error) {
      log(`Failed to stop ${server.type} instance ${server.instanceId}: ${error}`, colors.red);
    }
  });

  log('\n✓ All servers stopped', colors.green);
  process.exit(0);
}

// Handle Ctrl+C
process.on('SIGINT', stopAllServers);
process.on('SIGTERM', stopAllServers);

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  log(`\nUncaught exception: ${error.message}`, colors.red);
  console.error(error);
  stopAllServers();
});

process.on('unhandledRejection', (reason, promise) => {
  log(`\nUnhandled rejection at: ${promise}, reason: ${reason}`, colors.red);
  stopAllServers();
});

// Start all servers
startAllServers().catch((error) => {
  log(`\nFailed to start servers: ${error.message}`, colors.red);
  console.error(error);
  process.exit(1);
});
