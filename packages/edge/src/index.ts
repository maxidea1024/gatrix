import { config, validateConfig } from './config/env';
import logger from './config/logger';
import app from './app';
import { sdkManager } from './services/sdkManager';
import { startMetricsServer, sdkInitialized } from './services/metricsServer';
import { tokenMirrorService } from './services/tokenMirrorService';

/**
 * Main entry point for Edge server
 */
async function main(): Promise<void> {
  logger.info('Starting Gatrix Edge Server...');

  try {
    // Validate configuration
    validateConfig();
    logger.info('Configuration validated');

    // Start metrics server (internal only)
    startMetricsServer();

    // Initialize SDK first (waits for backend to be ready)
    await sdkManager.initialize();
    sdkInitialized.set(1);

    // Initialize token mirror service (for local token validation)
    // This comes after SDK initialization since backend should be ready at this point
    await tokenMirrorService.initialize();
    logger.info(`Token mirror initialized with ${tokenMirrorService.getTokenCount()} tokens`);

    // Start main HTTP server
    const server = app.listen(config.port, () => {
      logger.info(`Edge server listening on port ${config.port}`);
      logger.info(`Environment: ${config.nodeEnv}`);
      logger.info(`Target environments: ${config.environments === '*' ? '*' : config.environments.join(', ')}`);
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);

      server.close(async () => {
        logger.info('HTTP server closed');

        try {
          await sdkManager.shutdown();
          await tokenMirrorService.shutdown();
          sdkInitialized.set(0);
          logger.info('Shutdown complete');
          process.exit(0);
        } catch (error) {
          logger.error('Error during shutdown:', error);
          process.exit(1);
        }
      });

      // Force exit after 30 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    logger.error('Failed to start Edge server:', error);
    process.exit(1);
  }
}

// Run main
main();

