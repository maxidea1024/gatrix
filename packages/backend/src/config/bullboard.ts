import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { Queue } from "bullmq";
import logger from "./logger";

// Bull Board 설정
export class BullBoardConfig {
  private static serverAdapter: ExpressAdapter;
  private static queues: Queue[] = [];

  static initialize() {
    try {
      // Express adapter 생성
      this.serverAdapter = new ExpressAdapter();
      this.serverAdapter.setBasePath("/bull-board");

      // Bull Board 생성
      createBullBoard({
        queues: [], // 초기에는 빈 배열
        serverAdapter: this.serverAdapter,
      });

      logger.info("Bull Board initialized successfully");
      return this.serverAdapter;
    } catch (error) {
      logger.error("Failed to initialize Bull Board:", error);
      throw error;
    }
  }

  static addQueue(queue: Queue) {
    try {
      if (!this.queues.find((q) => q.name === queue.name)) {
        this.queues.push(queue);

        // Bull Board에 큐 추가
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
