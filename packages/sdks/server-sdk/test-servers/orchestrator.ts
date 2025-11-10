/**
 * Test Server Orchestrator
 * 
 * Starts and manages multiple test server instances
 */

import { spawn, ChildProcess } from 'child_process';
import path from 'path';

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
    this.servers.push(
      { name: 'authd-1', script: 'authd.ts', args: ['1', '8001', 'production', 'true'] }
    );

    // Lobby servers (2 instances)
    this.servers.push(
      { name: 'lobbyd-1', script: 'lobbyd.ts', args: ['1', '8002', 'production', 'true'] },
      { name: 'lobbyd-2', script: 'lobbyd.ts', args: ['2', '8012', 'production', 'true'] }
    );

    // Chat servers (1 instance)
    this.servers.push(
      { name: 'chatd-1', script: 'chatd.ts', args: ['1', '8003', 'production', 'true'] }
    );

    // World servers (1 instance)
    this.servers.push(
      { name: 'worldd-kr-1', script: 'worldd.ts', args: ['1', '8004', 'kr-1', 'true'] }
    );
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
      // Use shell: true for both Windows and Unix to ensure proper signal handling
      const proc = spawn('npx', ['ts-node', scriptPath, ...server.args], {
        stdio: 'inherit',
        shell: true,
        detached: false, // Don't detach - let orchestrator manage the process
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

    for (const server of this.servers) {
      if (server.process) {
        console.log(`[ORCHESTRATOR] Stopping ${server.name}...`);
        // Send SIGTERM to the process
        // Since detached: false, this will terminate the shell and the child process
        server.process.kill('SIGTERM');
      }
    }

    // Wait for all processes to exit
    await this.sleep(3000);

    console.log('');
    console.log('='.repeat(80));
    console.log('All servers stopped');
    console.log('='.repeat(80));
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Main execution
const orchestrator = new TestOrchestrator();

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nReceived SIGINT...');
  await orchestrator.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nReceived SIGTERM...');
  await orchestrator.stop();
  process.exit(0);
});

// Start orchestrator
orchestrator.start().catch((error) => {
  console.error('Failed to start orchestrator:', error);
  process.exit(1);
});

