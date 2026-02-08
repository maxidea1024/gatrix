/**
 * Test Server Orchestrator
 *
 * Starts and manages multiple test server instances
 */

import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { sleep } from '../src/utils/time';

interface ServerInstance {
  name: string;
  script: string;
  args: string[];
  process?: ChildProcess;
}

class TestOrchestrator {
  private servers: ServerInstance[] = [];
  private isShuttingDown = false;

  constructor() {
    this.setupServers();
  }

  private setupServers(): void {
    // Auth servers (1 instance)
    this.servers.push({
      name: 'authd-1',
      script: 'authd.ts',
      args: ['1', '8001', 'production', 'true'],
    });

    // Lobby servers (2 instances)
    this.servers.push(
      {
        name: 'lobbyd-1',
        script: 'lobbyd.ts',
        args: ['1', '8002', 'production', 'true'],
      },
      {
        name: 'lobbyd-2',
        script: 'lobbyd.ts',
        args: ['2', '8012', 'production', 'true'],
      }
    );

    // Chat servers (1 instance)
    this.servers.push({
      name: 'chatd-1',
      script: 'chatd.ts',
      args: ['1', '8003', 'production', 'true'],
    });

    // World servers (1 instance)
    this.servers.push({
      name: 'worldd-kr-1',
      script: 'worldd.ts',
      args: ['1', '8004', 'kr-1', 'true'],
    });
  }

  async start(): Promise<void> {
    console.log('='.repeat(80));
    console.log('Starting Gatrix Server SDK Test Orchestrator');
    console.log('='.repeat(80));
    console.log('');
    console.log('Test Scenario:');
    console.log('  - 1 Auth server (production)');
    console.log('  - 2 Lobby servers (production)');
    console.log('  - 1 Chat server (production)');
    console.log('  - 1 World server (kr-1)');
    console.log('');
    console.log('Total: 5 server instances');
    console.log('='.repeat(80));
    console.log('');

    // Start servers with delay
    for (const server of this.servers) {
      await this.startServer(server);
      // Wait a bit between starts to avoid overwhelming the system
      await this.sleep(2000);
    }

    console.log('');
    console.log('='.repeat(80));
    console.log('All servers started!');
    console.log('Press Ctrl+C to stop all servers');
    console.log('='.repeat(80));
    console.log('');
  }

  private async startServer(server: ServerInstance): Promise<void> {
    return new Promise((resolve) => {
      console.log(`[ORCHESTRATOR] Starting ${server.name}...`);

      const scriptPath = path.join(__dirname, server.script);

      // Use ts-node to run TypeScript directly
      const proc = spawn('npx', ['ts-node', scriptPath, ...server.args], {
        stdio: 'inherit',
        shell: true,
        detached: false,
        env: {
          ...process.env,
          FORCE_COLOR: '1',
        },
      });

      server.process = proc;

      proc.on('error', (error) => {
        console.error(`[ORCHESTRATOR] Error starting ${server.name}:`, error);
      });

      proc.on('exit', (code, signal) => {
        if (!this.isShuttingDown) {
          console.log(`[ORCHESTRATOR] ${server.name} exited with code ${code}, signal ${signal}`);
        }
      });

      // Give it a moment to start
      setTimeout(resolve, 500);
    });
  }

  async stop(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;

    console.log('');
    console.log('='.repeat(80));
    console.log('Stopping all servers...');
    console.log('='.repeat(80));
    console.log('');

    // Ask all processes to shut down gracefully
    for (const server of this.servers) {
      if (server.process && !server.process.killed && server.process.pid) {
        console.log(`[ORCHESTRATOR] Requesting graceful stop for ${server.name}...`);
        try {
          if (process.platform === 'win32') {
            // Windows: send SIGTERM to the process
            try {
              server.process.kill('SIGTERM');
            } catch (_e) {
              // If SIGTERM fails, try SIGINT
              try {
                server.process.kill('SIGINT');
              } catch {
                /* noop */
              }
            }
          } else {
            // Unix: send SIGTERM to the process group
            process.kill(-server.process.pid, 'SIGTERM');
          }
        } catch (error) {
          console.error(`[ORCHESTRATOR] Error signaling ${server.name}:`, error);
        }
      }
    }

    // Wait for graceful shutdown (increased to 10 seconds to allow unregister API calls)
    await this.sleep(10000);

    // Force kill any remaining processes
    for (const server of this.servers) {
      if (server.process && !server.process.killed && server.process.pid) {
        console.log(`[ORCHESTRATOR] Force killing ${server.name}...`);
        try {
          if (process.platform === 'win32') {
            const { execSync } = require('child_process');
            try {
              execSync(`taskkill /PID ${server.process.pid} /T /F`, {
                stdio: 'ignore',
                shell: 'cmd.exe',
                windowsHide: true,
              });
            } catch (e) {
              server.process.kill('SIGKILL');
            }
          } else {
            process.kill(-server.process.pid, 'SIGKILL');
          }
        } catch (error) {
          console.error(`[ORCHESTRATOR] Error force killing ${server.name}:`, error);
        }
      }
    }

    console.log('');
    console.log('='.repeat(80));
    console.log('All servers stopped');
    console.log('='.repeat(80));
  }
}

// Main execution
const orchestrator = new TestOrchestrator();

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nReceived SIGINT...');
  await orchestrator.stop();
  // Close stdin to prevent PowerShell from prompting
  if (process.stdin) {
    process.stdin.destroy();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nReceived SIGTERM...');
  await orchestrator.stop();
  // Close stdin to prevent PowerShell from prompting
  if (process.stdin) {
    process.stdin.destroy();
  }
  process.exit(0);
});

// Monitor stdin for any input to trigger graceful shutdown
if (process.stdin.isTTY) {
  process.stdin.setRawMode(true);
  process.stdin.resume();
}

process.stdin.on('data', async () => {
  console.log('\nReceived input, initiating graceful shutdown...');
  await orchestrator.stop();
  process.exit(0);
});

// Start orchestrator
orchestrator.start().catch((error) => {
  console.error('Failed to start orchestrator:', error);
  process.exit(1);
});
