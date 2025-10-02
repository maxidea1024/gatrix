import { config } from './config';
import { createLogger } from './config/logger';
import ChatServerApp from './app';

const logger = createLogger('ChatServer');

// Set server ID for clustering
if (!process.env.SERVER_ID) {
  process.env.SERVER_ID = `chat-server-${process.pid}-${Date.now()}`;
}

async function startServer(): Promise<void> {
  console.log('=== CHAT SERVER STARTING ===');
  try {
    console.log('Step 1: Logger info...');
    logger.info('Starting Chat Server...', {
      nodeEnv: config.nodeEnv,
      serverId: process.env.SERVER_ID,
      pid: process.pid,
      timestamp: new Date().toISOString(),
    });

    console.log('Step 2: Creating app...');
    const app = new ChatServerApp();

    console.log('Step 3: Starting app...');
    await app.start();

    console.log('=== CHAT SERVER STARTED ===');

  } catch (error) {
    console.error('=== STARTUP ERROR ===', error);
    logger.error('Error during server startup:', error);
    process.exit(1);
  }
}

// Start the server
startServer().catch((error) => {
  logger.error('Unhandled error during server startup:', error);
  process.exit(1);
});
