import cluster from "cluster";
import os from "os";
import { config } from "./config";
import logger from "./config/logger";

const numCPUs = os.cpus().length;
const numWorkers = config.cluster.workers || numCPUs;

if (cluster.isPrimary) {
  logger.info(`Master ${process.pid} is running`);
  logger.info(`Starting ${numWorkers} workers`);

  // Fork workers
  for (let i = 0; i < numWorkers; i++) {
    const worker = cluster.fork();
    worker.on("message", (message) => {
      // Handle inter-worker communication
      if (message.type === "broadcast") {
        // Broadcast to all other workers
        for (const id in cluster.workers) {
          const otherWorker = cluster.workers[id];
          if (otherWorker && otherWorker.id !== worker.id) {
            otherWorker.send(message);
          }
        }
      }
    });
  }

  // Handle worker exit
  cluster.on("exit", (worker, code, signal) => {
    logger.warn(
      `Worker ${worker.process.pid} died with code ${code} and signal ${signal}`,
    );
    logger.info("Starting a new worker");
    cluster.fork();
  });

  // Graceful shutdown
  process.on("SIGTERM", () => {
    logger.info("Master received SIGTERM, shutting down workers");
    for (const id in cluster.workers) {
      cluster.workers[id]?.kill();
    }
  });

  process.on("SIGINT", () => {
    logger.info("Master received SIGINT, shutting down workers");
    for (const id in cluster.workers) {
      cluster.workers[id]?.kill();
    }
  });
} else {
  // Worker process
  require("./index");
}
