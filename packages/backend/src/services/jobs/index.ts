import { JobFactory } from "./JobFactory";
import { MailSendJob } from "./MailSendJob";
import { HttpRequestJob } from "./HttpRequestJob";
import { SshCommandJob } from "./SshCommandJob";
import { LogMessageJob } from "./LogMessageJob";
import { CampaignCheckJob } from "./CampaignCheckJob";
import logger from "../../config/logger";

// Job 타입들을 Factory에 등록
export function initializeJobTypes(): void {
  try {
    // 기본 Job 타입들 등록
    JobFactory.registerJobType("mailsend", MailSendJob);
    JobFactory.registerJobType("http_request", HttpRequestJob);
    JobFactory.registerJobType("ssh_command", SshCommandJob);
    JobFactory.registerJobType("log_message", LogMessageJob);
    JobFactory.registerJobType("campaign-check", CampaignCheckJob);

    logger.info("Job types initialized successfully");
  } catch (error) {
    logger.error("Failed to initialize job types:", error);
    throw error;
  }
}

// 모든 Job 관련 export
export * from "./JobFactory";
export * from "./MailSendJob";
export * from "./HttpRequestJob";
export * from "./SshCommandJob";
export * from "./LogMessageJob";
export * from "./CampaignCheckJob";
