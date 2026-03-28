import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { Queue } from 'bullmq';
import logger from './logger';

// Bull Board Settings
export class BullBoardConfig {
  private static serverAdapter: ExpressAdapter;
  private static queues: Queue[] = [];

  static initialize() {
    try {
      // Express adapter Create
      this.serverAdapter = new ExpressAdapter();
      this.serverAdapter.setBasePath('/bull-board');

      // Bull Board Create
      createBullBoard({
        queues: [], // Initially empty array
        serverAdapter: this.serverAdapter,
      });

      logger.info('Bull Board initialized successfully');
      return this.serverAdapter;
    } catch (error) {
      logger.error('Failed to initialize Bull Board:', error);
      throw error;
    }
  }

  static addQueue(queue: Queue) {
    try {
      if (!this.queues.find((q) => q.name === queue.name)) {
        this.queues.push(queue);

        // Add queue to Bull Board
        createBullBoard({
          queues: this.queues.map((q) => new BullMQAdapter(q)),
          serverAdapter: this.serverAdapter,
        });

        logger.info(`Queue '${queue.name}' added to Bull Board`);
      }
    } catch (error) {
      logger.error(`Failed to add queue '${queue.name}' to Bull Board:`, error);
    }
  }

  static getServerAdapter() {
    return this.serverAdapter;
  }

  static getQueues() {
    return this.queues;
  }
}
