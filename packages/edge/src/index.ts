import { config, validateConfig } from './config/env';
import logger from './config/logger';
import app from './app';
import internalApp from './internalApp';
import { sdkManager } from './services/sdkManager';
import { initEdgeMetrics, sdkInitialized } from './services/edgeMetrics';
import { tokenMirrorService } from './services/tokenMirrorService';
import { tokenUsageTracker } from './services/tokenUsageTracker';
import { metricsAggregator } from './services/metricsAggregator';

/**
 * Main entry point for Edge server
 */
async function main(): Promise<void> {
  logger.info('Starting Gatrix Edge Server...');

  try {
    // Validate configuration
    validateConfig();
    logger.info('Configuration validated');

    // Initialize SDK first (waits for backend to be ready)
    // This also starts the SDK metrics serverinternally
    await sdkManager.initialize();

    // Initialize custom edge metrics using the SDK registry
    initEdgeMetrics();
    if (sdkInitialized) sdkInitialized.set(1);

    // Initialize token mirror service (for local token validation)
    // This comes after SDK initialization since backend should be ready at this point
    await tokenMirrorService.initialize();
    logger.info(`Token mirror initialized with ${tokenMirrorService.getTokenCount()} tokens`);

    // Initialize token usage tracker (for reporting usage to backend)
    await tokenUsageTracker.initialize();

    // Initialize Flag Streaming Service (SSE for SDK clients)
    const { flagStreamingService } = await import('./services/FlagStreamingService');
    await flagStreamingService.start();
    logger.info('Flag Streaming Service initialized');

    // Start main HTTP server
    const server = app.listen(config.port, () => {
      logger.info(`Edge server listening on port ${config.port}`);
      logger.info(`Environment: ${config.nodeEnv}`);
      logger.info(
        `Target environments: ${config.environments === '*' ? '*' : config.environments.join(', ')}`
      );
    });

    // Start internal HTTP server on separate port (main port + 10)
    const internalPort = config.port + 10;
    const internalServer = internalApp.listen(internalPort, () => {
      logger.info(`Edge internal server listening on port ${internalPort}`);
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);

      // Close both servers
      server.close(async () => {
        logger.info('Main HTTP server closed');
      });

      internalServer.close(async () => {
        logger.info('Internal HTTP server closed');
      });

      // Wait a bit for servers to close, then cleanup
      setTimeout(async () => {
        try {
          await metricsAggregator.shutdown();
          await tokenUsageTracker.shutdown();
          await sdkManager.shutdown();
          await tokenMirrorService.shutdown();
          sdkInitialized.set(0);
          logger.info('Shutdown complete');
          process.exit(0);
        } catch (error) {
          logger.error('Error during shutdown:', error);
          process.exit(1);
        }
      }, 1000);

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
