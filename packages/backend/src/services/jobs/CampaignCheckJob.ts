import { BaseJob, JobExecutionResult } from "./JobFactory";
import logger from "../../config/logger";
import knex from "../../config/knex";

export class CampaignCheckJob extends BaseJob {
  async execute(): Promise<JobExecutionResult> {
    const startTime = Date.now();

    try {
      logger.debug("Processing campaign check job");

      // Direct campaign check logic without CampaignScheduler dependency
      await this.checkAndUpdateCampaigns();

      const executionTime = Date.now() - startTime;
      logger.debug(
        `Campaign check job completed successfully in ${executionTime}ms`,
      );

      return {
        success: true,
        data: { message: "Campaign check completed successfully" },
        executionTimeMs: executionTime,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      logger.error("Error in campaign check job:", error);

      return {
        success: false,
        error: errorMessage,
        executionTimeMs: executionTime,
      };
    }
  }

  /**
   * Check and update campaign statuses
   */
  private async checkAndUpdateCampaigns(): Promise<void> {
    try {
      const now = new Date();

      // Find campaigns that should start (draft/scheduled -> running)
      const campaignsToStart = await knex("g_remote_config_campaigns")
        .where("isActive", true)
        .whereIn("status", ["draft", "scheduled"])
        .where(function () {
          this.whereNull("startDate").orWhere("startDate", "<=", now);
        });

      // Find campaigns that should end (running -> completed)
      const campaignsToEnd = await knex("g_remote_config_campaigns")
        .where("isActive", true)
        .where("status", "running")
        .where("endDate", "<=", now);

      let startedCount = 0;
      let endedCount = 0;

      // Start campaigns
      for (const campaign of campaignsToStart) {
        await knex("g_remote_config_campaigns")
          .where("id", campaign.id)
          .update({ status: "running" });
        startedCount++;
      }

      // End campaigns
      for (const campaign of campaignsToEnd) {
        await knex("g_remote_config_campaigns")
          .where("id", campaign.id)
          .update({ status: "completed" });
        endedCount++;
      }

      if (startedCount > 0 || endedCount > 0) {
        logger.info(
          `Campaign check: started ${startedCount}, ended ${endedCount}`,
        );
      }
    } catch (error) {
      logger.error("Error in campaign check:", error);
      throw error;
    }
  }
}
