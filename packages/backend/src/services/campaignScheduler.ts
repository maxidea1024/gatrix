import * as cron from 'node-cron';
import db from '../config/database';
import logger from '../config/logger';
import { CampaignEvaluator } from '../utils/trafficSplitter';
import { RemoteConfigNotifications } from './sseNotificationService';

export class CampaignScheduler {
  private static instance: CampaignScheduler;
  private scheduledTasks: Map<string, cron.ScheduledTask> = new Map();
  private isRunning = false;

  private constructor() {}

  public static getInstance(): CampaignScheduler {
    if (!CampaignScheduler.instance) {
      CampaignScheduler.instance = new CampaignScheduler();
    }
    return CampaignScheduler.instance;
  }

  /**
   * Start the campaign scheduler
   */
  public start(): void {
    if (this.isRunning) {
      logger.warn('Campaign scheduler is already running');
      return;
    }

    logger.info('Starting campaign scheduler...');
    
    // Schedule periodic check every minute
    const mainTask = cron.schedule('* * * * *', async () => {
      await this.checkAndUpdateCampaigns();
    }, {
      timezone: 'UTC'
    });

    mainTask.start();
    this.scheduledTasks.set('main', mainTask);
    this.isRunning = true;

    // Initial check
    this.checkAndUpdateCampaigns();

    logger.info('Campaign scheduler started successfully');
  }

  /**
   * Stop the campaign scheduler
   */
  public stop(): void {
    if (!this.isRunning) {
      logger.warn('Campaign scheduler is not running');
      return;
    }

    logger.info('Stopping campaign scheduler...');

    // Stop all scheduled tasks
    this.scheduledTasks.forEach((task, name) => {
      task.stop();
      task.destroy();
      logger.debug(`Stopped scheduled task: ${name}`);
    });

    this.scheduledTasks.clear();
    this.isRunning = false;

    logger.info('Campaign scheduler stopped successfully');
  }

  /**
   * Check and update campaign statuses
   */
  private async checkAndUpdateCampaigns(): Promise<void> {
    try {
      const now = new Date();
      
      // Get all campaigns that might need status updates
      const [rows] = await db.query(`
        SELECT * FROM g_remote_config_campaigns
        WHERE (
          (startDate <= ? AND endDate >= ? AND isActive = false) OR
          (endDate < ? AND isActive = true)
        )
      `, [now, now, now]);

      const campaigns = Array.isArray(rows) ? rows : [];

      if (campaigns.length === 0) {
        return;
      }

      logger.debug(`Found ${campaigns.length} campaigns to update`);

      for (const campaign of campaigns) {
        await this.updateCampaignStatus(campaign, now);
      }

    } catch (error) {
      logger.error('Error checking campaigns:', error);
    }
  }

  /**
   * Update individual campaign status
   */
  private async updateCampaignStatus(campaign: any, now: Date): Promise<void> {
    try {
      const startDate = new Date(campaign.startDate);
      const endDate = new Date(campaign.endDate);
      const shouldBeActive = CampaignEvaluator.isCampaignActive(startDate, endDate, now);

      if (campaign.isActive !== shouldBeActive) {
        await db.query(`
          UPDATE g_remote_config_campaigns
          SET isActive = ?, updatedAt = ?
          WHERE id = ?
        `, [shouldBeActive, now, campaign.id]);

        const action = shouldBeActive ? 'activated' : 'deactivated';
        logger.info(`Campaign "${campaign.campaignName}" (ID: ${campaign.id}) ${action} automatically`);

        // Send SSE notification
        RemoteConfigNotifications.notifyCampaignStatusChange(campaign.id, shouldBeActive, 'scheduler');

        // Log the status change
        await this.logCampaignStatusChange(campaign.id, shouldBeActive, 'scheduler', now);

        // If campaign was activated, check for conflicts with other campaigns
        if (shouldBeActive) {
          await this.resolveConflictingCampaigns(campaign, now);
        }
      }
    } catch (error) {
      logger.error(`Error updating campaign ${campaign.id}:`, error);
    }
  }

  /**
   * Resolve conflicts between overlapping campaigns
   */
  private async resolveConflictingCampaigns(activatedCampaign: any, now: Date): Promise<void> {
    try {
      // Get all active campaigns that might conflict
      const [conflictingRows] = await db.query(`
        SELECT * FROM g_remote_config_campaigns
        WHERE isActive = true
        AND id != ?
        AND startDate <= ?
        AND endDate >= ?
      `, [activatedCampaign.id, now, now]);

      const conflictingCampaigns = Array.isArray(conflictingRows) ? conflictingRows : [];

      if (conflictingCampaigns.length === 0) {
        return;
      }

      // Check if any campaigns target the same configs
      const [activatedConfigRows] = await db.query(`
        SELECT configId FROM g_remote_config_campaign_configs
        WHERE campaignId = ?
      `, [activatedCampaign.id]);

      const activatedConfigs = Array.isArray(activatedConfigRows) ? activatedConfigRows : [];
      const activatedConfigIds = activatedConfigs.map((c: any) => c.configId);

      for (const conflictingCampaign of conflictingCampaigns as any[]) {
        const [conflictingConfigRows] = await db.query(`
          SELECT configId FROM g_remote_config_campaign_configs
          WHERE campaignId = ?
        `, [conflictingCampaign.id]);

        const conflictingConfigs = Array.isArray(conflictingConfigRows) ? conflictingConfigRows : [];
        const conflictingConfigIds = conflictingConfigs.map((c: any) => c.configId);

        // Check for overlap
        const hasOverlap = activatedConfigIds.some((id: any) => conflictingConfigIds.includes(id));

        if (hasOverlap) {
          // Compare priorities - higher priority wins
          if (activatedCampaign.priority > conflictingCampaign.priority) {
            await db.query(`
              UPDATE g_remote_config_campaigns
              SET isActive = false, updatedAt = ?
              WHERE id = ?
            `, [now, conflictingCampaign.id]);

            logger.info(`Campaign "${conflictingCampaign.campaignName}" (ID: ${conflictingCampaign.id}) deactivated due to higher priority campaign`);
            
            await this.logCampaignStatusChange(conflictingCampaign.id, false, 'priority_conflict', now);
          } else if (activatedCampaign.priority < conflictingCampaign.priority) {
            // Current campaign has lower priority, deactivate it
            await db.query(`
              UPDATE g_remote_config_campaigns
              SET isActive = false, updatedAt = ?
              WHERE id = ?
            `, [now, activatedCampaign.id]);

            logger.info(`Campaign "${activatedCampaign.campaignName}" (ID: ${activatedCampaign.id}) deactivated due to lower priority`);
            
            await this.logCampaignStatusChange(activatedCampaign.id, false, 'priority_conflict', now);
            break;
          }
        }
      }
    } catch (error) {
      logger.error('Error resolving campaign conflicts:', error);
    }
  }

  /**
   * Log campaign status changes
   */
  private async logCampaignStatusChange(
    campaignId: number,
    isActive: boolean,
    reason: string,
    timestamp: Date
  ): Promise<void> {
    try {
      await db.query(`
        INSERT INTO g_remote_config_campaign_logs
        (campaignId, action, reason, timestamp, createdAt)
        VALUES (?, ?, ?, ?, ?)
      `, [
        campaignId,
        isActive ? 'activated' : 'deactivated',
        reason,
        timestamp,
        timestamp
      ]);
    } catch (error) {
      logger.error('Error logging campaign status change:', error);
    }
  }

  /**
   * Schedule a specific campaign activation/deactivation
   */
  public scheduleCampaign(campaignId: number, startDate: Date, endDate: Date): void {
    const now = new Date();

    // Schedule activation if in the future
    if (startDate > now) {
      const activationTask = cron.schedule(this.dateToCron(startDate), async () => {
        await this.activateCampaign(campaignId);
        this.scheduledTasks.delete(`activate_${campaignId}`);
      }, {
        timezone: 'UTC'
      });

      activationTask.start();
      this.scheduledTasks.set(`activate_${campaignId}`, activationTask);
      
      logger.info(`Scheduled campaign ${campaignId} activation for ${startDate.toISOString()}`);
    }

    // Schedule deactivation if in the future
    if (endDate > now) {
      const deactivationTask = cron.schedule(this.dateToCron(endDate), async () => {
        await this.deactivateCampaign(campaignId);
        this.scheduledTasks.delete(`deactivate_${campaignId}`);
      }, {
        timezone: 'UTC'
      });

      deactivationTask.start();
      this.scheduledTasks.set(`deactivate_${campaignId}`, deactivationTask);
      
      logger.info(`Scheduled campaign ${campaignId} deactivation for ${endDate.toISOString()}`);
    }
  }

  /**
   * Convert Date to cron expression
   */
  private dateToCron(date: Date): string {
    const minute = date.getUTCMinutes();
    const hour = date.getUTCHours();
    const day = date.getUTCDate();
    const month = date.getUTCMonth() + 1;
    
    return `${minute} ${hour} ${day} ${month} *`;
  }

  /**
   * Manually activate a campaign
   */
  private async activateCampaign(campaignId: number): Promise<void> {
    try {
      const now = new Date();
      
      await db.query(`
        UPDATE g_remote_config_campaigns
        SET isActive = true, updatedAt = ?
        WHERE id = ?
      `, [now, campaignId]);

      logger.info(`Campaign ${campaignId} activated by scheduler`);
      await this.logCampaignStatusChange(campaignId, true, 'scheduled_activation', now);

      // Check for conflicts
      const [campaignRows] = await db.query(`
        SELECT * FROM g_remote_config_campaigns
        WHERE id = ? LIMIT 1
      `, [campaignId]);

      const campaigns = Array.isArray(campaignRows) ? campaignRows : [];
      const campaign = campaigns[0];

      if (campaign) {
        await this.resolveConflictingCampaigns(campaign, now);
      }
    } catch (error) {
      logger.error(`Error activating campaign ${campaignId}:`, error);
    }
  }

  /**
   * Manually deactivate a campaign
   */
  private async deactivateCampaign(campaignId: number): Promise<void> {
    try {
      const now = new Date();
      
      await db.query(`
        UPDATE g_remote_config_campaigns
        SET isActive = false, updatedAt = ?
        WHERE id = ?
      `, [now, campaignId]);

      logger.info(`Campaign ${campaignId} deactivated by scheduler`);
      await this.logCampaignStatusChange(campaignId, false, 'scheduled_deactivation', now);
    } catch (error) {
      logger.error(`Error deactivating campaign ${campaignId}:`, error);
    }
  }

  /**
   * Get scheduler status
   */
  public getStatus(): {
    isRunning: boolean;
    scheduledTasksCount: number;
    scheduledTasks: string[];
  } {
    return {
      isRunning: this.isRunning,
      scheduledTasksCount: this.scheduledTasks.size,
      scheduledTasks: Array.from(this.scheduledTasks.keys())
    };
  }
}

export default CampaignScheduler;
