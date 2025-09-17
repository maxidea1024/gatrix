import { config } from './config';
import logger from './config/logger';
import ChatServerApp from './app';

// Set server ID for clustering
if (!process.env.SERVER_ID) {
  process.env.SERVER_ID = `chat-server-${process.pid}-${Date.now()}`;
}

async function startServer(): Promise<void> {
  try {
    logger.info('Starting Chat Server...', {
      nodeEnv: config.nodeEnv,
      serverId: process.env.SERVER_ID,
      pid: process.pid,
      timestamp: new Date().toISOString(),
    });

    const app = new ChatServerApp();
    await app.start();

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer().catch((error) => {
  logger.error('Unhandled error during server startup:', error);
  process.exit(1);
});
