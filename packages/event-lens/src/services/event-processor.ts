import { ulid } from "ulid";
import { EventNormalizer } from "./event-normalizer";
import { eventQueue } from "../config/bullmq";
import logger from "../utils/logger";

export class EventProcessor {
  private normalizer: EventNormalizer;

  constructor() {
    this.normalizer = new EventNormalizer();
  }

  async process(rawEvent: any): Promise<void> {
    try {
      // 1. 이벤트 ID 생성 (ULID - 시간순 정렬 가능)
      const eventId = ulid();

      // 2. 이벤트 정규화
      const normalizedEvent = this.normalizer.normalize({
        ...rawEvent,
        id: eventId,
      });

      // 3. 큐에 추가
      await eventQueue.add(
        "process-event",
        {
          event: normalizedEvent,
        },
        {
          jobId: eventId,
        },
      );

      logger.debug("Event queued", {
        eventId,
        projectId: normalizedEvent.projectId,
      });
    } catch (error) {
      logger.error("Failed to process event", { error, rawEvent });
      throw error;
    }
  }

  async processIdentify(rawEvent: any): Promise<void> {
    try {
      const { profileId, deviceId, projectId, ...traits } = rawEvent;

      // 프로필 큐에 추가
      const { profileQueue } = await import("../config/bullmq");
      await profileQueue.add("identify-profile", {
        projectId,
        profileId,
        deviceId,
        traits,
      });

      logger.debug("Profile identify queued", { profileId, projectId });
    } catch (error) {
      logger.error("Failed to process identify", { error, rawEvent });
      throw error;
    }
  }

  async processIncrement(rawEvent: any): Promise<void> {
    try {
      const { profileId, projectId, property, value = 1 } = rawEvent;

      const { profileQueue } = await import("../config/bullmq");
      await profileQueue.add("increment-property", {
        projectId,
        profileId,
        property,
        value,
      });

      logger.debug("Profile increment queued", { profileId, property, value });
    } catch (error) {
      logger.error("Failed to process increment", { error, rawEvent });
      throw error;
    }
  }

  async processDecrement(rawEvent: any): Promise<void> {
    try {
      const { profileId, projectId, property, value = 1 } = rawEvent;

      const { profileQueue } = await import("../config/bullmq");
      await profileQueue.add("decrement-property", {
        projectId,
        profileId,
        property,
        value: -value,
      });

      logger.debug("Profile decrement queued", { profileId, property, value });
    } catch (error) {
      logger.error("Failed to process decrement", { error, rawEvent });
      throw error;
    }
  }
}

export default EventProcessor;
