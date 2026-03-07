import {
  ReleaseFlowModel,
  ReleaseFlowMilestoneModel,
  ReleaseFlowStrategyModel,
  ReleaseFlowAttributes,
  ReleaseFlowMilestoneAttributes,
  TransitionCondition,
} from '../models/release-flow';
import { FeatureStrategyModel } from '../models/FeatureFlag';
import { AuditLogModel } from '../models/audit-log';
import { GatrixError } from '../middleware/error-handler';
import { ErrorCodes } from '../utils/api-response';
import { createLogger } from '../config/logger';

const logger = createLogger('ReleaseFlowService');
import db from '../config/knex';
import { ulid } from 'ulid';
import { pubSubService } from './pub-sub-service';
import { queueService } from './queue-service';

export interface CreateTemplateInput {
  flowName: string;
  displayName?: string;
  description?: string;
  milestones: {
    name: string;
    sortOrder: number;
    transitionCondition?: TransitionCondition | null;
    strategies: {
      strategyName: string;
      parameters?: any;
      constraints?: any[];
      segments?: string[];
      sortOrder: number;
    }[];
  }[];
}

export class ReleaseFlowService {
  // ==================== Delayed Job Helpers ====================

  /**
   * Unique job ID for a plan's milestone progression delayed job.
   * Using a deterministic ID allows us to cancel/replace the job easily.
   */
  private progressionJobId(planId: string): string {
    return `rf-progress:${planId}`;
  }

  /**
   * Schedule a delayed job to progress to the next milestone after the
   * transition interval elapses. Cancels any existing job for this plan first.
   */
  private async scheduleProgressionJob(planId: string, delayMs: number): Promise<void> {
    // Cancel any existing delayed job for this plan
    await this.cancelProgressionJob(planId);

    const jobId = this.progressionJobId(planId);
    await queueService.addJob(
      'scheduler',
      'release-flow:milestone-progression',
      { planId },
      { delay: delayMs }
    );
    logger.info(
      `Scheduled milestone progression for plan ${planId} in ${delayMs}ms (jobId hint: ${jobId})`
    );
  }

  /**
   * Cancel any pending progression delayed job for a plan.
   */
  private async cancelProgressionJob(planId: string): Promise<void> {
    try {
      const queue = queueService.getQueue('scheduler');
      if (!queue) return;

      // Find and remove delayed jobs matching this plan
      const delayed = await queue.getDelayed();
      for (const job of delayed) {
        if (
          job.name === 'release-flow:milestone-progression' &&
          job.data?.payload?.planId === planId
        ) {
          await job.remove();
          logger.info(`Cancelled progression job ${job.id} for plan ${planId}`);
        }
      }
    } catch (error) {
      logger.warn(`Failed to cancel progression job for plan ${planId}:`, error);
    }
  }

  /**
   * Create a new release flow template
   */
  async createTemplate(input: CreateTemplateInput, userId: string): Promise<ReleaseFlowAttributes> {
    const trx = await db.transaction();
    try {
      const flow = await ReleaseFlowModel.create({
        flowName: input.flowName,
        displayName: input.displayName,
        description: input.description,
        discriminator: 'template',
        createdBy: userId,
        isArchived: false,
        status: 'draft',
      });

      for (const mInput of input.milestones) {
        const milestone = await ReleaseFlowMilestoneModel.create({
          flowId: flow.id,
          name: mInput.name,
          sortOrder: mInput.sortOrder,
          transitionCondition: mInput.transitionCondition || null,
        });

        for (const sInput of mInput.strategies) {
          const strategy = await ReleaseFlowStrategyModel.create({
            milestoneId: milestone.id,
            strategyName: sInput.strategyName,
            parameters: sInput.parameters,
            constraints: sInput.constraints,
            sortOrder: sInput.sortOrder,
          });

          if (sInput.segments && sInput.segments.length > 0) {
            await ReleaseFlowStrategyModel.updateSegments(strategy.id, sInput.segments);
          }
        }
      }

      await trx.commit();

      await AuditLogModel.create({
        action: 'release_flow.template_create',
        description: `Release flow template '${input.flowName}' created with ${input.milestones.length} milestone(s)`,
        resourceType: 'ReleaseFlow',
        resourceId: flow.id,
        userId,
        newValues: input,
      });

      return (await ReleaseFlowModel.findById(flow.id))!;
    } catch (error) {
      await trx.rollback();
      logger.error('Error creating release flow template:', error);
      throw error;
    }
  }

  /**
   * Apply a template to a feature flag and environment
   */
  async applyTemplateToFlag(
    flagId: string,
    environmentId: string,
    templateId: string,
    userId: string
  ): Promise<ReleaseFlowAttributes> {
    const template = await ReleaseFlowModel.findById(templateId);
    if (!template || template.discriminator !== 'template') {
      throw new GatrixError('Template not found', 404, true, ErrorCodes.NOT_FOUND);
    }

    const existingPlan = await ReleaseFlowModel.findPlanByFlagAndEnv(flagId, environmentId);
    if (existingPlan) {
      throw new GatrixError(
        'A release flow is already active for this flag and environment',
        400,
        true,
        ErrorCodes.BAD_REQUEST
      );
    }

    const trx = await db.transaction();
    try {
      const plan = await ReleaseFlowModel.create({
        flowName: template.flowName,
        displayName: template.displayName,
        description: template.description,
        discriminator: 'plan',
        flagId,
        environmentId,
        createdBy: userId,
        isArchived: false,
        status: 'draft',
      });

      // Copy milestones and strategies from template to plan
      for (const tMilestone of template.milestones || []) {
        const pMilestone = await ReleaseFlowMilestoneModel.create({
          flowId: plan.id,
          name: tMilestone.name,
          sortOrder: tMilestone.sortOrder,
          transitionCondition: tMilestone.transitionCondition || null,
        });

        for (const tStrategy of tMilestone.strategies || []) {
          const pStrategy = await ReleaseFlowStrategyModel.create({
            milestoneId: pMilestone.id,
            strategyName: tStrategy.strategyName,
            parameters: tStrategy.parameters,
            constraints: tStrategy.constraints,
            sortOrder: tStrategy.sortOrder,
          });

          if (tStrategy.segments && tStrategy.segments.length > 0) {
            await ReleaseFlowStrategyModel.updateSegments(pStrategy.id, tStrategy.segments);
          }
        }
      }

      await trx.commit();

      await AuditLogModel.create({
        action: 'release_flow.apply_plan',
        description: `Release flow template '${template.flowName}' applied to flag '${flagId}' in [${environmentId}]`,
        resourceType: 'ReleaseFlow',
        resourceId: plan.id,
        userId,
        environmentId,
        newValues: { flagId, environmentId, templateId },
      });

      return (await ReleaseFlowModel.findById(plan.id))!;
    } catch (error) {
      await trx.rollback();
      logger.error('Error applying release flow template:', error);
      throw error;
    }
  }

  /**
   * Start a milestone in a plan
   */
  async startMilestone(
    planId: string,
    milestoneId: string,
    userId: string | null
  ): Promise<ReleaseFlowAttributes> {
    const plan = await ReleaseFlowModel.findById(planId);
    if (!plan || plan.discriminator !== 'plan') {
      throw new GatrixError('Release plan not found', 404, true, ErrorCodes.NOT_FOUND);
    }

    const milestone = (plan.milestones || []).find((m) => m.id === milestoneId);
    if (!milestone) {
      throw new GatrixError('Milestone not found in plan', 404, true, ErrorCodes.NOT_FOUND);
    }

    const trx = await db.transaction();
    try {
      // 1. Update plan's active milestone and status
      await ReleaseFlowModel.update(plan.id, {
        activeMilestoneId: milestone.id,
        status: 'active',
        updatedBy: userId ?? undefined,
      });
      await ReleaseFlowMilestoneModel.update(milestone.id, {
        startedAt: new Date(),
        pausedAt: null,
        progressionExecutedAt: null,
      });

      // 1b. Clear pausedAt on all OTHER milestones (handles jumping from a paused milestone)
      for (const m of plan.milestones || []) {
        if (m.id !== milestone.id && m.pausedAt) {
          await ReleaseFlowMilestoneModel.update(m.id, { pausedAt: null });
        }
      }

      // 2. CRITICAL: Clear existing live strategies for this flag and environment
      // This is a design choice: a release flow milestone OVERWRITES existing strategies
      await db('g_feature_strategies')
        .where('flagId', plan.flagId)
        .where('environmentId', plan.environmentId)
        .del();

      // 3. CRITICAL: Promote milestone strategies to feature strategies
      for (const ms of milestone.strategies || []) {
        const strategyId = ulid();
        await db('g_feature_strategies').insert({
          id: strategyId,
          flagId: plan.flagId,
          environmentId: plan.environmentId,
          strategyName: ms.strategyName,
          parameters: ms.parameters ? JSON.stringify(ms.parameters) : null,
          constraints: ms.constraints ? JSON.stringify(ms.constraints) : '[]',
          sortOrder: ms.sortOrder,
          isEnabled: true,
          createdBy: userId || null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Copy segments
        if (ms.segments && ms.segments.length > 0) {
          const segments = await db('g_feature_segments').whereIn('segmentName', ms.segments);
          const segmentIds = segments.map((s) => s.id);
          if (segmentIds.length > 0) {
            const links = segmentIds.map((segmentId) => ({
              id: ulid(),
              strategyId,
              segmentId,
            }));
            await db('g_feature_flag_segments').insert(links);
          }
        }
      }

      await trx.commit();

      await AuditLogModel.create({
        action: 'release_flow.start_milestone',
        description: `Release flow milestone '${milestone.name}' started for plan '${plan.flowName}'`,
        resourceType: 'ReleaseFlow',
        resourceId: plan.id,
        userId: userId ?? undefined,
        environmentId: plan.environmentId,
        newValues: { milestoneId, milestoneName: milestone.name },
      });

      // 4. CRITICAL: Bump flag version and notify SDKs about strategy changes
      // Without this, SDKs will not detect the new strategies from the milestone
      const flag = await db('g_feature_flags').where('id', plan.flagId).select('flagName').first();
      if (flag && plan.environmentId) {
        await db('g_feature_flags')
          .where('id', plan.flagId)
          .update({
            version: db.raw('COALESCE(version, 0) + 1'),
            updatedAt: new Date(),
          });
        const { featureFlagService } = await import('./feature-flag-service');
        await featureFlagService.invalidateCache(plan.environmentId, [flag.flagName]);
      }

      // 5. Schedule delayed job for automatic progression
      if (milestone.transitionCondition?.intervalMinutes) {
        const delayMs = milestone.transitionCondition.intervalMinutes * 60 * 1000;
        await this.scheduleProgressionJob(plan.id, delayMs);
      } else {
        // No transition condition — cancel any lingering delayed job
        await this.cancelProgressionJob(plan.id);
      }

      // 6. Broadcast SSE event for UI real-time update
      await pubSubService.publishNotification({
        type: 'release_flow.milestone_started',
        data: {
          planId: plan.id,
          flagId: plan.flagId,
          environmentId: plan.environmentId,
          activeMilestoneId: milestone.id,
          milestoneName: milestone.name,
          status: 'active',
        },
      });

      return (await ReleaseFlowModel.findById(plan.id))!;
    } catch (error) {
      await trx.rollback();
      logger.error('Error starting release flow milestone:', error);
      throw error;
    }
  }

  /**
   * Start a plan (begins from the first milestone)
   */
  async startPlan(planId: string, userId: string): Promise<ReleaseFlowAttributes> {
    const plan = await ReleaseFlowModel.findById(planId);
    if (!plan || plan.discriminator !== 'plan') {
      throw new GatrixError('Release plan not found', 404, true, ErrorCodes.NOT_FOUND);
    }

    if (plan.status === 'active') {
      throw new GatrixError('Plan is already active', 400, true, ErrorCodes.BAD_REQUEST);
    }

    const milestones = plan.milestones || [];
    if (milestones.length === 0) {
      throw new GatrixError('Plan has no milestones', 400, true, ErrorCodes.BAD_REQUEST);
    }

    // Start from the first milestone
    const firstMilestone = milestones.sort((a, b) => a.sortOrder - b.sortOrder)[0];
    return this.startMilestone(planId, firstMilestone.id, userId);
  }

  /**
   * Pause the current plan (stops progression timer)
   */
  async pausePlan(planId: string, userId: string): Promise<ReleaseFlowAttributes> {
    const plan = await ReleaseFlowModel.findById(planId);
    if (!plan || plan.discriminator !== 'plan') {
      throw new GatrixError('Release plan not found', 404, true, ErrorCodes.NOT_FOUND);
    }

    if (plan.status !== 'active') {
      throw new GatrixError('Plan is not active', 400, true, ErrorCodes.BAD_REQUEST);
    }

    // Pause the active milestone
    if (plan.activeMilestoneId) {
      await ReleaseFlowMilestoneModel.update(plan.activeMilestoneId, {
        pausedAt: new Date(),
      });
    }

    // Cancel any pending progression delayed job
    await this.cancelProgressionJob(planId);

    await ReleaseFlowModel.update(planId, { status: 'paused', updatedBy: userId });

    await AuditLogModel.create({
      action: 'release_flow.pause_plan',
      description: `Release flow plan '${plan.flowName}' paused`,
      resourceType: 'ReleaseFlow',
      resourceId: planId,
      userId,
      environmentId: plan.environmentId,
    });

    // Broadcast SSE event for UI real-time update
    await pubSubService.publishNotification({
      type: 'release_flow.plan_paused',
      data: {
        planId,
        flagId: plan.flagId,
        environmentId: plan.environmentId,
        status: 'paused',
      },
    });

    return (await ReleaseFlowModel.findById(planId))!;
  }

  /**
   * Resume a paused plan
   */
  async resumePlan(planId: string, userId: string): Promise<ReleaseFlowAttributes> {
    const plan = await ReleaseFlowModel.findById(planId);
    if (!plan || plan.discriminator !== 'plan') {
      throw new GatrixError('Release plan not found', 404, true, ErrorCodes.NOT_FOUND);
    }

    if (plan.status !== 'paused') {
      throw new GatrixError('Plan is not paused', 400, true, ErrorCodes.BAD_REQUEST);
    }

    // Clear pause on the active milestone
    if (plan.activeMilestoneId) {
      const activeMilestone = (plan.milestones || []).find((m) => m.id === plan.activeMilestoneId);
      if (activeMilestone && activeMilestone.pausedAt && activeMilestone.startedAt) {
        // Extend the startedAt by the duration it was paused
        const pauseDuration = new Date().getTime() - new Date(activeMilestone.pausedAt).getTime();
        const newStartedAt = new Date(
          new Date(activeMilestone.startedAt).getTime() + pauseDuration
        );
        await ReleaseFlowMilestoneModel.update(plan.activeMilestoneId, {
          pausedAt: null,
          startedAt: newStartedAt,
        });
      } else {
        await ReleaseFlowMilestoneModel.update(plan.activeMilestoneId, {
          pausedAt: null,
        });
      }
    }

    // Re-schedule delayed job with remaining transition time
    if (plan.activeMilestoneId) {
      // Re-read the milestone to get the updated startedAt
      const updatedMilestone = await ReleaseFlowMilestoneModel.findById(plan.activeMilestoneId);
      if (updatedMilestone?.transitionCondition?.intervalMinutes && updatedMilestone.startedAt) {
        const requiredMs = updatedMilestone.transitionCondition.intervalMinutes * 60 * 1000;
        const elapsedMs = new Date().getTime() - new Date(updatedMilestone.startedAt).getTime();
        const remainingMs = Math.max(0, requiredMs - elapsedMs);
        await this.scheduleProgressionJob(planId, remainingMs);
      }
    }

    await ReleaseFlowModel.update(planId, { status: 'active', updatedBy: userId });

    await AuditLogModel.create({
      action: 'release_flow.resume_plan',
      description: `Release flow plan '${plan.flowName}' resumed`,
      resourceType: 'ReleaseFlow',
      resourceId: planId,
      userId,
      environmentId: plan.environmentId,
    });

    // Broadcast SSE event for UI real-time update
    await pubSubService.publishNotification({
      type: 'release_flow.plan_resumed',
      data: {
        planId,
        flagId: plan.flagId,
        environmentId: plan.environmentId,
        status: 'active',
      },
    });

    return (await ReleaseFlowModel.findById(planId))!;
  }

  /**
   * Progress to the next milestone (called by scheduler or manually)
   */
  async progressToNextMilestone(
    planId: string,
    userId?: string
  ): Promise<ReleaseFlowAttributes | null> {
    const plan = await ReleaseFlowModel.findById(planId);
    if (!plan || plan.discriminator !== 'plan' || plan.status !== 'active') {
      return null;
    }

    const milestones = (plan.milestones || []).sort((a, b) => a.sortOrder - b.sortOrder);
    const currentIndex = milestones.findIndex((m) => m.id === plan.activeMilestoneId);

    if (currentIndex < 0) {
      return null;
    }

    // Check if this is the last milestone
    if (currentIndex >= milestones.length - 1) {
      // Mark current milestone as progressed and complete the plan
      await ReleaseFlowMilestoneModel.update(milestones[currentIndex].id, {
        progressionExecutedAt: new Date(),
      });
      await ReleaseFlowModel.update(planId, {
        status: 'completed',
        updatedBy: userId ?? undefined,
      });

      await AuditLogModel.create({
        action: 'release_flow.complete_plan',
        description: `Release flow plan '${plan.flowName}' completed`,
        resourceType: 'ReleaseFlow',
        resourceId: planId,
        userId: userId ?? undefined,
        environmentId: plan.environmentId,
      });

      // Broadcast SSE event for UI real-time update
      await pubSubService.publishNotification({
        type: 'release_flow.plan_completed',
        data: {
          planId,
          flagId: plan.flagId,
          environmentId: plan.environmentId,
          status: 'completed',
        },
      });

      return (await ReleaseFlowModel.findById(planId))!;
    }

    // Start the next milestone first, then mark current as progressed
    // This order prevents a stuck state if startMilestone fails
    const nextMilestone = milestones[currentIndex + 1];
    const result = await this.startMilestone(planId, nextMilestone.id, userId || null);

    // Only mark as progressed after successful transition
    await ReleaseFlowMilestoneModel.update(milestones[currentIndex].id, {
      progressionExecutedAt: new Date(),
    });

    return result;
  }

  /**
   * Set transition condition on a milestone
   */
  async setTransitionCondition(
    milestoneId: string,
    transitionCondition: TransitionCondition,
    userId: string
  ): Promise<ReleaseFlowMilestoneAttributes> {
    const milestone = await ReleaseFlowMilestoneModel.findById(milestoneId);
    if (!milestone) {
      throw new GatrixError('Milestone not found', 404, true, ErrorCodes.NOT_FOUND);
    }

    if (transitionCondition.intervalMinutes < 1) {
      throw new GatrixError(
        'Interval must be at least 1 minute',
        400,
        true,
        ErrorCodes.BAD_REQUEST
      );
    }

    const updated = await ReleaseFlowMilestoneModel.update(milestoneId, { transitionCondition });

    await AuditLogModel.create({
      action: 'release_flow.set_transition',
      description: `Transition condition set on milestone '${milestone.name}' (${transitionCondition.intervalMinutes}min interval)`,
      resourceType: 'ReleaseFlowMilestone',
      resourceId: milestoneId,
      userId,
      newValues: { transitionCondition },
    });

    return updated;
  }

  /**
   * Remove transition condition from a milestone
   */
  async removeTransitionCondition(
    milestoneId: string,
    userId: string
  ): Promise<ReleaseFlowMilestoneAttributes> {
    const milestone = await ReleaseFlowMilestoneModel.findById(milestoneId);
    if (!milestone) {
      throw new GatrixError('Milestone not found', 404, true, ErrorCodes.NOT_FOUND);
    }

    const updated = await ReleaseFlowMilestoneModel.update(milestoneId, {
      transitionCondition: null,
    });

    await AuditLogModel.create({
      action: 'release_flow.remove_transition',
      description: `Transition condition removed from milestone '${milestone.name}'`,
      resourceType: 'ReleaseFlowMilestone',
      resourceId: milestoneId,
      userId,
    });

    return updated;
  }

  async updateTemplate(
    id: string,
    input: Partial<CreateTemplateInput>,
    userId: string
  ): Promise<ReleaseFlowAttributes> {
    const trx = await db.transaction();
    try {
      const existing = await ReleaseFlowModel.findById(id);
      if (!existing || existing.discriminator !== 'template') {
        throw new GatrixError('Template not found', 404, true, ErrorCodes.NOT_FOUND);
      }

      // Update main flow record
      await ReleaseFlowModel.update(id, {
        flowName: input.flowName,
        displayName: input.displayName,
        description: input.description,
        updatedBy: userId,
      });

      // If milestones are provided, they replace all existing ones (simpler for now)
      if (input.milestones) {
        // Remove existing ones
        const oldMilestones = await ReleaseFlowMilestoneModel.findByFlowId(id);
        for (const om of oldMilestones) {
          await ReleaseFlowMilestoneModel.delete(om.id); // This should cascade to strategies in DB
        }

        // Create new ones
        for (const mInput of input.milestones) {
          const milestone = await ReleaseFlowMilestoneModel.create({
            flowId: id,
            name: mInput.name,
            sortOrder: mInput.sortOrder,
            transitionCondition: mInput.transitionCondition || null,
          });

          for (const sInput of mInput.strategies) {
            const strategy = await ReleaseFlowStrategyModel.create({
              milestoneId: milestone.id,
              strategyName: sInput.strategyName,
              parameters: sInput.parameters,
              constraints: sInput.constraints,
              sortOrder: sInput.sortOrder,
            });

            if (sInput.segments && sInput.segments.length > 0) {
              await ReleaseFlowStrategyModel.updateSegments(strategy.id, sInput.segments);
            }
          }
        }
      }

      await trx.commit();

      await AuditLogModel.create({
        action: 'release_flow.template_update',
        description: `Release flow template '${input.flowName || existing.flowName}' updated`,
        resourceType: 'ReleaseFlow',
        resourceId: id,
        userId,
        newValues: input,
      });

      return (await ReleaseFlowModel.findById(id))!;
    } catch (error) {
      await trx.rollback();
      logger.error('Error updating release flow template:', error);
      throw error;
    }
  }

  async deleteTemplate(id: string, userId: string): Promise<void> {
    const existing = await ReleaseFlowModel.findById(id);
    if (!existing || existing.discriminator !== 'template') {
      throw new GatrixError('Template not found', 404, true, ErrorCodes.NOT_FOUND);
    }

    // Hard delete or soft delete? User rule says "isArchived" columns are common.
    // Let's go with archiving for safety.
    await ReleaseFlowModel.update(id, {
      isArchived: true,
      updatedBy: userId,
      archivedAt: new Date(),
    });

    await AuditLogModel.create({
      action: 'release_flow.template_delete',
      description: `Release flow template '${existing.flowName}' archived`,
      resourceType: 'ReleaseFlow',
      resourceId: id,
      userId,
    });
  }

  async getTemplateById(id: string): Promise<ReleaseFlowAttributes> {
    const template = await ReleaseFlowModel.findById(id);
    if (!template || template.discriminator !== 'template') {
      throw new GatrixError('Template not found', 404, true, ErrorCodes.NOT_FOUND);
    }
    return template;
  }

  async getTemplates(): Promise<ReleaseFlowAttributes[]> {
    return ReleaseFlowModel.listTemplates();
  }

  async getPlanForFlag(
    flagId: string,
    environmentId: string
  ): Promise<ReleaseFlowAttributes | null> {
    return ReleaseFlowModel.findPlanByFlagAndEnv(flagId, environmentId);
  }

  /**
   * Delete (archive) an applied release flow plan
   */
  async deletePlan(planId: string, userId: string): Promise<void> {
    const plan = await ReleaseFlowModel.findById(planId);
    if (!plan || plan.discriminator !== 'plan') {
      throw new GatrixError('Plan not found', 404, true, ErrorCodes.NOT_FOUND);
    }

    // Cancel any pending progression delayed job
    await this.cancelProgressionJob(planId);

    await ReleaseFlowModel.update(planId, {
      isArchived: true,
      updatedBy: userId,
      archivedAt: new Date(),
    });

    await AuditLogModel.create({
      action: 'release_flow.plan_delete',
      description: `Release flow plan '${plan.flowName}' removed from flag '${plan.flagId}' in [${plan.environmentId}]`,
      resourceType: 'ReleaseFlow',
      resourceId: planId,
      userId,
      environmentId: plan.environmentId,
    });
  }
}

export const releaseFlowService = new ReleaseFlowService();
