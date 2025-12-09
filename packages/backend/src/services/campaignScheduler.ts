import knex from '../config/knex';
import logger from '../config/logger';
import { pubSubService } from './PubSubService';
import { QueueService, queueService } from './QueueService';

export class CampaignScheduler {
  private static instance: CampaignScheduler;
  private queueService: QueueService;
  private isRunning = false;
  private checkInProgress = false;

  private constructor() {
    this.queueService = queueService;
  }

  public static getInstance(): CampaignScheduler {
    if (!CampaignScheduler.instance) {
      CampaignScheduler.instance = new CampaignScheduler();
    }
    return CampaignScheduler.instance;
  }

  /**
   * Start the campaign scheduler
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Campaign scheduler is already running');
      return;
    }

    logger.info('Starting enhanced campaign scheduler...');

    try {
      // Schedule periodic check every minute using QueueService
      // Check if job already exists to avoid redundant calls
      const repeatables = await this.queueService.listRepeatable('scheduler');
      const exists = repeatables.some(j => j.name === 'campaign-check');

      if (!exists) {
        await this.queueService.addJob('scheduler', 'campaign-check', {}, {
          repeat: { pattern: '* * * * *' } // Every minute
        });
        logger.info('Scheduled campaign-check job');
      } else {
        logger.info('campaign-check job already scheduled');
      }

      this.isRunning = true;

      // Initial check
      await this.checkAndUpdateCampaigns();

      logger.info('Enhanced campaign scheduler started successfully');
    } catch (error) {
      logger.error('Error starting campaign scheduler:', error);
      throw error;
    }
  }

  /**
   * Stop the campaign scheduler
   */
  public async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Campaign scheduler is not running');
      return;
    }

    logger.info('Stopping campaign scheduler...');

    try {
      // Remove all scheduled jobs from the scheduler queue
      const schedulerQueue = this.queueService.getQueue('scheduler');
      if (schedulerQueue) {
        await schedulerQueue.obliterate({ force: true });
        logger.debug('Cleared all scheduled campaign jobs');
      }

      this.isRunning = false;
      logger.info('Campaign scheduler stopped successfully');
    } catch (error) {
      logger.error('Error stopping campaign scheduler:', error);
      this.isRunning = false;
    }
  }

  /**
   * Check and update campaign statuses
   */
  public async checkAndUpdateCampaigns(): Promise<void> {
    if (this.checkInProgress) {
      logger.debug('Campaign check already in progress, skipping...');
      return;
    }

    this.checkInProgress = true;
    try {
      const now = new Date();

      // Find campaigns that should start (draft/scheduled -> running)
      const campaignsToStart = await knex('g_remote_config_campaigns')
        .where('isActive', true)
        .whereIn('status', ['draft', 'scheduled'])
        .where(function () {
          this.whereNull('startDate').orWhere('startDate', '<=', now);
        });

      // Find campaigns that should end (running -> completed)
      const campaignsToEnd = await knex('g_remote_config_campaigns')
        .where('status', 'running')
        .where('endDate', '<=', now);

      let startedCount = 0;
      let endedCount = 0;

      // Start campaigns
      for (const campaign of campaignsToStart) {
        await this.startCampaign(campaign);
        startedCount++;
      }

      // End campaigns
      for (const campaign of campaignsToEnd) {
        await this.endCampaign(campaign);
        endedCount++;
      }

      // Clean up expired cache
      await this.cleanupExpiredCache();

      if (startedCount > 0 || endedCount > 0) {
        logger.info(`Campaign scheduler: started ${startedCount}, ended ${endedCount}`);
      }
    } catch (error) {
      logger.error('Error in checkAndUpdateCampaigns:', error);
    } finally {
      this.checkInProgress = false;
    }
  }

  /**
   * Start a campaign
   */
  private async startCampaign(campaign: any): Promise<void> {
    try {
      await knex.transaction(async (trx) => {
        // Update campaign status
        await trx('g_remote_config_campaigns')
          .where('id', campaign.id)
          .update({
            status: 'running',
            updatedAt: new Date()
          });

        // Log the activation
        await trx('g_remote_config_campaign_logs').insert({
          campaignId: campaign.id,
          action: 'activated',
          reason: 'scheduler',
          timestamp: new Date(),
          details: JSON.stringify({
            scheduledStart: campaign.startDate,
            actualStart: new Date()
          })
        });
      });

      // Send real-time notification via PubSub (multi-instance)
      await pubSubService.publishNotification({
        type: 'remote_config_change',
        data: {
          configId: campaign.id,
          action: 'campaign_started',
          campaignName: campaign.campaignName
        },
        targetChannels: ['remote_config', 'admin']
      });

      logger.info(`Campaign started: ${campaign.campaignName} (ID: ${campaign.id})`);
    } catch (error) {
      logger.error(`Error starting campaign ${campaign.id}:`, error);
      throw error;
    }
  }

  /**
   * End a campaign
   */
  private async endCampaign(campaign: any): Promise<void> {
    try {
      await knex.transaction(async (trx) => {
        // Update campaign status
        await trx('g_remote_config_campaigns')
          .where('id', campaign.id)
          .update({
            status: 'completed',
            updatedAt: new Date()
          });

        // Log the deactivation
        await trx('g_remote_config_campaign_logs').insert({
          campaignId: campaign.id,
          action: 'deactivated',
          reason: 'scheduler',
          timestamp: new Date(),
          details: JSON.stringify({
            scheduledEnd: campaign.endDate,
            actualEnd: new Date()
          })
        });

        // Clear cache for this campaign
        await trx('g_remote_config_campaign_cache')
          .where('campaignId', campaign.id)
          .del();
      });

      // Send real-time notification via PubSub (multi-instance)
      await pubSubService.publishNotification({
        type: 'remote_config_change',
        data: {
          configId: campaign.id,
          action: 'campaign_ended',
          campaignName: campaign.campaignName
        },
        targetChannels: ['remote_config', 'admin']
      });

      logger.info(`Campaign ended: ${campaign.campaignName} (ID: ${campaign.id})`);
    } catch (error) {
      logger.error(`Error ending campaign ${campaign.id}:`, error);
      throw error;
    }
  }

  /**
   * Clean up expired cache entries
   */
  private async cleanupExpiredCache(): Promise<void> {
    try {
      const now = new Date();
      const deletedCount = await knex('g_remote_config_campaign_cache')
        .where('expiresAt', '<', now)
        .del();

      if (deletedCount > 0) {
        logger.debug(`Cleaned up ${deletedCount} expired cache entries`);
      }
    } catch (error) {
      logger.error('Error cleaning up cache:', error);
      throw error;
    }
  }

  /**
   * Manually activate a campaign
   */
  public async activateCampaign(campaignId: number, userId?: number): Promise<void> {
    try {
      await knex.transaction(async (trx) => {
        await trx('g_remote_config_campaigns')
          .where('id', campaignId)
          .update({
            status: 'running',
            updatedBy: userId,
            updatedAt: new Date()
          });

        await trx('g_remote_config_campaign_logs').insert({
          campaignId,
          action: 'activated',
          reason: 'manual',
          timestamp: new Date(),
          details: JSON.stringify({ activatedBy: userId })
        });
      });

      logger.info(`Campaign manually activated: ID ${campaignId} by user ${userId}`);
    } catch (error) {
      logger.error(`Error manually activating campaign ${campaignId}:`, error);
      throw error;
    }
  }

  /**
   * Manually deactivate a campaign
   */
  public async deactivateCampaign(campaignId: number, userId?: number): Promise<void> {
    try {
      await knex.transaction(async (trx) => {
        await trx('g_remote_config_campaigns')
          .where('id', campaignId)
          .update({
            status: 'paused',
            updatedBy: userId,
            updatedAt: new Date()
          });

        await trx('g_remote_config_campaign_logs').insert({
          campaignId,
          action: 'deactivated',
          reason: 'manual',
          timestamp: new Date(),
          details: JSON.stringify({ deactivatedBy: userId })
        });

        // Clear cache for this campaign
        await trx('g_remote_config_campaign_cache')
          .where('campaignId', campaignId)
          .del();
      });

      logger.info(`Campaign manually deactivated: ID ${campaignId} by user ${userId}`);
    } catch (error) {
      logger.error(`Error manually deactivating campaign ${campaignId}:`, error);
      throw error;
    }
  }
}
