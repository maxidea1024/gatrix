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
    // Auth servers (2 instances)
    this.servers.push(
      { name: 'authd-1', script: 'authd.ts', args: ['1', '8001', 'production', 'true'] },
      { name: 'authd-2', script: 'authd.ts', args: ['2', '8011', 'production', 'true'] }
    );

    // Lobby servers (3 instances - 2 production, 1 staging)
    this.servers.push(
      { name: 'lobbyd-1', script: 'lobbyd.ts', args: ['1', '8002', 'production', 'true'] },
      { name: 'lobbyd-2', script: 'lobbyd.ts', args: ['2', '8012', 'production', 'true'] },
      { name: 'lobbyd-3', script: 'lobbyd.ts', args: ['3', '8022', 'staging', 'true'] }
    );

    // Chat servers (2 instances)
    this.servers.push(
      { name: 'chatd-1', script: 'chatd.ts', args: ['1', '8003', 'production', 'true'] },
      { name: 'chatd-2', script: 'chatd.ts', args: ['2', '8013', 'production', 'true'] }
    );

    // World servers (4 instances - different regions)
    this.servers.push(
      { name: 'worldd-kr-1', script: 'worldd.ts', args: ['1', '8004', 'kr-1', 'true'] },
      { name: 'worldd-kr-2', script: 'worldd.ts', args: ['2', '8014', 'kr-2', 'true'] },
      { name: 'worldd-us-east', script: 'worldd.ts', args: ['3', '8024', 'us-east', 'true'] },
      { name: 'worldd-us-west', script: 'worldd.ts', args: ['4', '8034', 'us-west', 'true'] }
    );
  }

  async start(): Promise<void> {
    console.log('='.repeat(80));
    console.log('Starting Gatrix Server SDK Test Orchestrator');
    console.log('='.repeat(80));
    console.log('');
    console.log('Test Scenario:');
    console.log('  - 2 Auth servers (production)');
    console.log('  - 3 Lobby servers (2 production, 1 staging)');
    console.log('  - 2 Chat servers (production)');
    console.log('  - 4 World servers (kr-1, kr-2, us-east, us-west)');
    console.log('');
    console.log('Total: 11 server instances');
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

