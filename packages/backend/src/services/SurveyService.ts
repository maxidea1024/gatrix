import db from '../config/knex';
import { GatrixError } from '../middleware/errorHandler';
import { ulid } from 'ulid';
import { getCurrentEnvironmentId } from '../utils/environmentContext';
import { Environment } from '../models/Environment';
import { pubSubService } from './PubSubService';

export interface TriggerCondition {
  type: 'userLevel' | 'joinDays';
  value: number;
}

export interface Reward {
  type: string;
  id: number;
  quantity: number;
}

export interface ChannelSubchannelData {
  channel: string;
  subchannels: string[];
}

/**
 * Internal Survey model (includes database fields not exposed in SDK)
 */
export interface Survey {
  id: string;
  environmentId?: string;
  platformSurveyId: string;
  surveyTitle: string;
  surveyContent?: string;
  triggerConditions: TriggerCondition[];
  participationRewards?: Reward[] | null;
  rewardTemplateId?: string | null; // Database field (not in SDK response)
  rewardMailTitle?: string;
  rewardMailContent?: string;
  isActive: boolean;
  // Targeting fields
  targetPlatforms?: string[] | null;
  targetPlatformsInverted?: boolean;
  targetChannels?: string[] | null;
  targetChannelsInverted?: boolean;
  targetSubchannels?: string[] | null;
  targetSubchannelsInverted?: boolean;
  targetWorlds?: string[] | null;
  targetWorldsInverted?: boolean;
  createdBy?: number;
  updatedBy?: number;
}

export interface SurveyConfig {
  baseSurveyUrl: string;
  baseJoinedUrl: string;
  linkCaption: string;
  joinedSecretKey: string;
}

export interface CreateSurveyInput {
  platformSurveyId: string;
  surveyTitle: string;
  surveyContent?: string;
  triggerConditions: TriggerCondition[];
  participationRewards?: Reward[] | null;
  rewardTemplateId?: string | null; // Database field (not in SDK response)
  rewardMailTitle?: string;
  rewardMailContent?: string;
  isActive?: boolean;
  // Targeting fields
  targetPlatforms?: string[] | null;
  targetPlatformsInverted?: boolean;
  targetChannels?: string[] | null;
  targetChannelsInverted?: boolean;
  targetSubchannels?: string[] | null;
  targetSubchannelsInverted?: boolean;
  targetWorlds?: string[] | null;
  targetWorldsInverted?: boolean;
  createdBy?: number;
}

export interface UpdateSurveyInput {
  platformSurveyId?: string;
  surveyTitle?: string;
  surveyContent?: string;
  triggerConditions?: TriggerCondition[];
  participationRewards?: Reward[] | null;
  rewardTemplateId?: string | null; // Database field (not in SDK response)
  rewardMailTitle?: string;
  rewardMailContent?: string;
  isActive?: boolean;
  // Targeting fields
  targetPlatforms?: string[] | null;
  targetPlatformsInverted?: boolean;
  targetChannels?: string[] | null;
  targetChannelsInverted?: boolean;
  targetSubchannels?: string[] | null;
  targetSubchannelsInverted?: boolean;
  targetWorlds?: string[] | null;
  targetWorldsInverted?: boolean;
  updatedBy?: number;
}

export class SurveyService {
  /**
   * Helper to resolve environment name from ID (which might be ULID or composite string)
   */
  private static async resolveEnvironmentName(envId: string): Promise<string> {
    if (!envId) return '';

    try {
      // Try to get from Environment model first
      const env = await Environment.query().findById(envId);
      if (env) {
        return env.environmentName;
      }
      // Fallback: assume format {name}.{ulid} or just use as is if split fails
      return envId.split('.')[0];
    } catch (error) {
      // Fallback on error
      return envId.split('.')[0];
    }
  }

  /**
   * Get all surveys with pagination
   */
  static async getSurveys(params: {
    page?: number;
    limit?: number;
    isActive?: boolean;
    search?: string;
    environmentId?: string;
  }): Promise<{ surveys: Survey[]; total: number; page: number; limit: number }> {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const offset = (page - 1) * limit;
    const envId = params.environmentId ?? getCurrentEnvironmentId();

    let query = db('g_surveys').where('environmentId', envId);
    let countQuery = db('g_surveys').where('environmentId', envId);

    if (params.isActive !== undefined) {
      query = query.where('isActive', params.isActive);
      countQuery = countQuery.where('isActive', params.isActive);
    }

    if (params.search) {
      query = query.where(function () {
        this.where('surveyTitle', 'like', `%${params.search}%`)
          .orWhere('platformSurveyId', 'like', `%${params.search}%`);
      });
      countQuery = countQuery.where(function () {
        this.where('surveyTitle', 'like', `%${params.search}%`)
          .orWhere('platformSurveyId', 'like', `%${params.search}%`);
      });
    }

    // Get total count
    const countResult = await countQuery.count('* as total').first();
    const total = (countResult?.total as number) || 0;

    // Get surveys
    const rows = await query
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .offset(offset);

    const surveys = rows.map(row => ({
      ...row,
      triggerConditions: typeof row.triggerConditions === 'string'
        ? JSON.parse(row.triggerConditions)
        : row.triggerConditions,
      participationRewards: row.participationRewards
        ? (typeof row.participationRewards === 'string'
          ? JSON.parse(row.participationRewards)
          : row.participationRewards)
        : null,
      targetPlatforms: row.targetPlatforms
        ? (typeof row.targetPlatforms === 'string'
          ? JSON.parse(row.targetPlatforms)
          : row.targetPlatforms)
        : null,
      targetChannels: row.targetChannels
        ? (typeof row.targetChannels === 'string'
          ? JSON.parse(row.targetChannels)
          : row.targetChannels)
        : null,
      targetSubchannels: row.targetSubchannels
        ? (typeof row.targetSubchannels === 'string'
          ? JSON.parse(row.targetSubchannels)
          : row.targetSubchannels)
        : null,
      targetWorlds: row.targetWorlds
        ? (typeof row.targetWorlds === 'string'
          ? JSON.parse(row.targetWorlds)
          : row.targetWorlds)
        : null,
    })) as Survey[];

    return { surveys, total, page, limit };
  }

  /**
   * Get survey by ID
   */
  static async getSurveyById(id: string, environmentId?: string): Promise<Survey> {
    const envId = environmentId ?? getCurrentEnvironmentId();
    const row = await db('g_surveys').where('id', id).where('environmentId', envId).first();

    if (!row) {
      throw new GatrixError('Survey not found', 404);
    }

    const survey = {
      ...row,
      triggerConditions: typeof row.triggerConditions === 'string'
        ? JSON.parse(row.triggerConditions)
        : row.triggerConditions,
      participationRewards: row.participationRewards
        ? (typeof row.participationRewards === 'string'
          ? JSON.parse(row.participationRewards)
          : row.participationRewards)
        : null,
      targetPlatforms: row.targetPlatforms
        ? (typeof row.targetPlatforms === 'string'
          ? JSON.parse(row.targetPlatforms)
          : row.targetPlatforms)
        : null,
      targetChannels: row.targetChannels
        ? (typeof row.targetChannels === 'string'
          ? JSON.parse(row.targetChannels)
          : row.targetChannels)
        : null,
      targetSubchannels: row.targetSubchannels
        ? (typeof row.targetSubchannels === 'string'
          ? JSON.parse(row.targetSubchannels)
          : row.targetSubchannels)
        : null,
      targetWorlds: row.targetWorlds
        ? (typeof row.targetWorlds === 'string'
          ? JSON.parse(row.targetWorlds)
          : row.targetWorlds)
        : null,
    } as Survey;

    return survey;
  }

  /**
   * Get survey by platform survey ID
   */
  static async getSurveyByPlatformId(platformSurveyId: string, environmentId?: string): Promise<Survey> {
    const envId = environmentId ?? getCurrentEnvironmentId();
    const row = await db('g_surveys').where('platformSurveyId', platformSurveyId).where('environmentId', envId).first();

    if (!row) {
      throw new GatrixError('Survey not found', 404);
    }

    const survey = {
      ...row,
      triggerConditions: typeof row.triggerConditions === 'string'
        ? JSON.parse(row.triggerConditions)
        : row.triggerConditions,
      participationRewards: row.participationRewards
        ? (typeof row.participationRewards === 'string'
          ? JSON.parse(row.participationRewards)
          : row.participationRewards)
        : null,
      targetPlatforms: row.targetPlatforms
        ? (typeof row.targetPlatforms === 'string'
          ? JSON.parse(row.targetPlatforms)
          : row.targetPlatforms)
        : null,
      targetChannels: row.targetChannels
        ? (typeof row.targetChannels === 'string'
          ? JSON.parse(row.targetChannels)
          : row.targetChannels)
        : null,
      targetSubchannels: row.targetSubchannels
        ? (typeof row.targetSubchannels === 'string'
          ? JSON.parse(row.targetSubchannels)
          : row.targetSubchannels)
        : null,
      targetWorlds: row.targetWorlds
        ? (typeof row.targetWorlds === 'string'
          ? JSON.parse(row.targetWorlds)
          : row.targetWorlds)
        : null,
    } as Survey;

    return survey;
  }

  /**
   * Create a new survey
   */
  static async createSurvey(input: CreateSurveyInput, environmentId?: string): Promise<Survey> {
    const envId = environmentId ?? getCurrentEnvironmentId();

    // Validate trigger conditions
    if (!input.triggerConditions || input.triggerConditions.length === 0) {
      throw new GatrixError('At least one trigger condition is required', 400);
    }

    // Validate that either participationRewards or rewardTemplateId is provided, but not both
    if (input.participationRewards && input.rewardTemplateId) {
      throw new GatrixError('Cannot specify both participationRewards and rewardTemplateId', 400);
    }

    // Check if platformSurveyId already exists in this environment
    const existing = await db('g_surveys')
      .where('platformSurveyId', input.platformSurveyId)
      .where('environmentId', envId)
      .first();

    if (existing) {
      throw new GatrixError('Platform survey ID already exists', 400);
    }

    const id = ulid();
    const isActive = input.isActive !== undefined ? input.isActive : true;

    await db('g_surveys').insert({
      id,
      environmentId: envId,
      platformSurveyId: input.platformSurveyId,
      surveyTitle: input.surveyTitle,
      surveyContent: input.surveyContent || null,
      triggerConditions: JSON.stringify(input.triggerConditions),
      participationRewards: input.participationRewards ? JSON.stringify(input.participationRewards) : null,
      rewardTemplateId: input.rewardTemplateId || null,
      rewardMailTitle: input.rewardMailTitle || null,
      rewardMailContent: input.rewardMailContent || null,
      isActive,
      targetPlatforms: input.targetPlatforms ? JSON.stringify(input.targetPlatforms) : null,
      targetPlatformsInverted: input.targetPlatformsInverted || false,
      targetChannels: (input as any).targetChannels ? JSON.stringify((input as any).targetChannels) : null,
      targetChannelsInverted: (input as any).targetChannelsInverted || false,
      targetSubchannels: (input as any).targetSubchannels ? JSON.stringify((input as any).targetSubchannels) : null,
      targetSubchannelsInverted: (input as any).targetSubchannelsInverted || false,
      targetWorlds: input.targetWorlds ? JSON.stringify(input.targetWorlds) : null,
      targetWorldsInverted: input.targetWorldsInverted || false,
      createdBy: input.createdBy || null,
    });

    const survey = await this.getSurveyById(id, envId);

    // Publish SDK event
    try {
      const envName = await this.resolveEnvironmentName(envId);
      await pubSubService.publishSDKEvent({
        type: 'survey.created',
        data: {
          id: survey.id,
          timestamp: Date.now(),
          isActive: survey.isActive,
          environment: envName
        }
      });
    } catch (err) {
      // ignore
    }

    return survey;
  }

  /**
   * Update a survey
   */
  static async updateSurvey(id: string, input: UpdateSurveyInput, environmentId?: string): Promise<Survey> {
    const envId = environmentId ?? getCurrentEnvironmentId();
    // Check if survey exists
    await this.getSurveyById(id, envId);

    // If platformSurveyId is being updated, check for duplicates in this environment
    if (input.platformSurveyId) {
      const existing = await db('g_surveys')
        .where('platformSurveyId', input.platformSurveyId)
        .where('environmentId', envId)
        .whereNot('id', id)
        .first();

      if (existing) {
        throw new GatrixError('Platform survey ID already exists', 400);
      }
    }

    // Validate trigger conditions if provided
    if (input.triggerConditions && input.triggerConditions.length === 0) {
      throw new GatrixError('At least one trigger condition is required', 400);
    }

    // Validate that either participationRewards or rewardTemplateId is provided, but not both
    if (input.participationRewards !== undefined && input.rewardTemplateId !== undefined) {
      if (input.participationRewards && input.rewardTemplateId) {
        throw new GatrixError('Cannot specify both participationRewards and rewardTemplateId', 400);
      }
    }

    const updateData: any = {};

    if (input.platformSurveyId !== undefined) updateData.platformSurveyId = input.platformSurveyId;
    if (input.surveyTitle !== undefined) updateData.surveyTitle = input.surveyTitle;
    if (input.surveyContent !== undefined) updateData.surveyContent = input.surveyContent;
    if (input.triggerConditions !== undefined) updateData.triggerConditions = JSON.stringify(input.triggerConditions);
    if (input.participationRewards !== undefined) updateData.participationRewards = input.participationRewards ? JSON.stringify(input.participationRewards) : null;
    if (input.rewardTemplateId !== undefined) updateData.rewardTemplateId = input.rewardTemplateId || null;
    if (input.rewardMailTitle !== undefined) updateData.rewardMailTitle = input.rewardMailTitle;
    if (input.rewardMailContent !== undefined) updateData.rewardMailContent = input.rewardMailContent;
    if (input.isActive !== undefined) updateData.isActive = input.isActive;
    if (input.targetPlatforms !== undefined) updateData.targetPlatforms = input.targetPlatforms ? JSON.stringify(input.targetPlatforms) : null;
    if (input.targetPlatformsInverted !== undefined) updateData.targetPlatformsInverted = input.targetPlatformsInverted;
    if ((input as any).targetChannels !== undefined) updateData.targetChannels = (input as any).targetChannels ? JSON.stringify((input as any).targetChannels) : null;
    if ((input as any).targetChannelsInverted !== undefined) updateData.targetChannelsInverted = (input as any).targetChannelsInverted;
    if ((input as any).targetSubchannels !== undefined) updateData.targetSubchannels = (input as any).targetSubchannels ? JSON.stringify((input as any).targetSubchannels) : null;
    if ((input as any).targetSubchannelsInverted !== undefined) updateData.targetSubchannelsInverted = (input as any).targetSubchannelsInverted;
    if (input.targetWorlds !== undefined) updateData.targetWorlds = input.targetWorlds ? JSON.stringify(input.targetWorlds) : null;
    if (input.targetWorldsInverted !== undefined) updateData.targetWorldsInverted = input.targetWorldsInverted;
    if (input.updatedBy !== undefined) updateData.updatedBy = input.updatedBy;

    if (Object.keys(updateData).length === 0) {
      throw new GatrixError('No fields to update', 400);
    }

    await db('g_surveys').where('id', id).where('environmentId', envId).update(updateData);

    const survey = await this.getSurveyById(id, envId);

    // Publish SDK event
    try {
      const envName = await this.resolveEnvironmentName(envId);
      await pubSubService.publishSDKEvent({
        type: 'survey.updated',
        data: {
          id: survey.id,
          timestamp: Date.now(),
          isActive: survey.isActive,
          environment: envName
        }
      });
    } catch (err) {
      // ignore
    }

    return survey;
  }

  /**
   * Delete a survey
   */
  static async deleteSurvey(id: string, environmentId?: string): Promise<void> {
    const envId = environmentId ?? getCurrentEnvironmentId();

    // Resolve env name before deletion is tricky if resolving relies on data, 
    // but here we resolve from envId which comes from context or param.
    // So valid.
    let envName = '';
    try {
      envName = await this.resolveEnvironmentName(envId);
    } catch (e) { }

    const result = await db('g_surveys').where('id', id).where('environmentId', envId).del();

    if (result === 0) {
      throw new GatrixError('Survey not found', 404);
    }

    // Publish SDK event
    try {
      await pubSubService.publishSDKEvent({
        type: 'survey.deleted',
        data: {
          id,
          timestamp: Date.now(),
          environment: envName
        }
      });
    } catch (err) {
      // ignore
    }
  }

  /**
   * Get survey configuration from g_vars
   */
  static async getSurveyConfig(): Promise<SurveyConfig> {
    const rows = await db('g_vars')
      .whereIn('varKey', ['survey.baseSurveyUrl', 'survey.baseJoinedUrl', 'survey.linkCaption', 'survey.joinedSecretKey']);

    const config: any = {};
    rows.forEach((row: any) => {
      const key = row.varKey.replace('survey.', '');
      config[key] = row.varValue;
    });

    // Set defaults if not found
    return {
      baseSurveyUrl: config.baseSurveyUrl || 'https://survey.dw.sdo.com',
      baseJoinedUrl: config.baseJoinedUrl || 'https://survey.dw.sdo.com/survey/joined',
      linkCaption: config.linkCaption || 'Respond to the survey',
      joinedSecretKey: config.joinedSecretKey || '123',
    };
  }

  /**
   * Update survey configuration in g_vars
   */
  static async updateSurveyConfig(input: Partial<SurveyConfig>): Promise<SurveyConfig> {
    const updates: Array<{ key: string; value: string }> = [];

    if (input.baseSurveyUrl !== undefined) {
      updates.push({ key: 'survey.baseSurveyUrl', value: input.baseSurveyUrl });
    }
    if (input.baseJoinedUrl !== undefined) {
      updates.push({ key: 'survey.baseJoinedUrl', value: input.baseJoinedUrl });
    }
    if (input.linkCaption !== undefined) {
      updates.push({ key: 'survey.linkCaption', value: input.linkCaption });
    }
    if (input.joinedSecretKey !== undefined) {
      updates.push({ key: 'survey.joinedSecretKey', value: input.joinedSecretKey });
    }

    if (updates.length === 0) {
      throw new GatrixError('No fields to update', 400);
    }

    // Update each var using raw query for ON DUPLICATE KEY UPDATE
    for (const update of updates) {
      await db.raw(
        `INSERT INTO g_vars (varKey, varValue, description, createdBy)
         VALUES (?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE varValue = VALUES(varValue), updatedBy = 1`,
        [update.key, update.value, `Survey configuration: ${update.key}`]
      );
    }

    // Publish SDK event
    try {
      const envId = getCurrentEnvironmentId();
      const envName = await this.resolveEnvironmentName(envId);
      await pubSubService.publishSDKEvent({
        type: 'survey.settings.updated',
        data: {
          id: 0,
          timestamp: Date.now(),
          environment: envName
        }
      });
    } catch (err) {
      // ignore
    }

    return await this.getSurveyConfig();
  }
}
