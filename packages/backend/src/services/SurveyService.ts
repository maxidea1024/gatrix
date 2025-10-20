import database from '../config/database';
import { CustomError } from '../middleware/errorHandler';
import { ulid } from 'ulid';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export interface TriggerCondition {
  type: 'userLevel' | 'joinDays';
  value: number;
}

export interface ParticipationReward {
  rewardType: string;
  itemId: string;
  quantity: number;
}

export interface Survey {
  id: string;
  platformSurveyId: string;
  surveyTitle: string;
  surveyContent?: string;
  triggerConditions: TriggerCondition[];
  participationRewards?: ParticipationReward[];
  rewardMailTitle?: string;
  rewardMailContent?: string;
  isActive: boolean;
  createdBy?: number;
  updatedBy?: number;
  createdAt: Date;
  updatedAt: Date;
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
  participationRewards?: ParticipationReward[];
  rewardMailTitle?: string;
  rewardMailContent?: string;
  isActive?: boolean;
  createdBy?: number;
}

export interface UpdateSurveyInput {
  platformSurveyId?: string;
  surveyTitle?: string;
  surveyContent?: string;
  triggerConditions?: TriggerCondition[];
  participationRewards?: ParticipationReward[];
  rewardMailTitle?: string;
  rewardMailContent?: string;
  isActive?: boolean;
  updatedBy?: number;
}

export class SurveyService {
  /**
   * Get all surveys with pagination
   */
  static async getSurveys(params: {
    page?: number;
    limit?: number;
    isActive?: boolean;
    search?: string;
  }): Promise<{ surveys: Survey[]; total: number; page: number; limit: number }> {
    const pool = database.getPool();
    const page = params.page || 1;
    const limit = params.limit || 20;
    const offset = (page - 1) * limit;

    let whereConditions: string[] = [];
    let queryParams: any[] = [];

    if (params.isActive !== undefined) {
      whereConditions.push('isActive = ?');
      queryParams.push(params.isActive);
    }

    if (params.search) {
      whereConditions.push('(surveyTitle LIKE ? OR platformSurveyId LIKE ?)');
      const searchPattern = `%${params.search}%`;
      queryParams.push(searchPattern, searchPattern);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get total count
    const [countRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM g_surveys ${whereClause}`,
      queryParams
    );
    const total = countRows[0].total;

    // Get surveys
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT * FROM g_surveys ${whereClause} ORDER BY createdAt DESC LIMIT ? OFFSET ?`,
      [...queryParams, limit, offset]
    );

    const surveys = rows.map(row => ({
      ...row,
      triggerConditions: JSON.parse(row.triggerConditions),
      participationRewards: row.participationRewards ? JSON.parse(row.participationRewards) : null,
    })) as Survey[];

    return { surveys, total, page, limit };
  }

  /**
   * Get survey by ID
   */
  static async getSurveyById(id: string): Promise<Survey> {
    const pool = database.getPool();
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM g_surveys WHERE id = ?',
      [id]
    );

    if (rows.length === 0) {
      throw new CustomError('Survey not found', 404);
    }

    const survey = {
      ...rows[0],
      triggerConditions: JSON.parse(rows[0].triggerConditions),
      participationRewards: rows[0].participationRewards ? JSON.parse(rows[0].participationRewards) : null,
    } as Survey;

    return survey;
  }

  /**
   * Get survey by platform survey ID
   */
  static async getSurveyByPlatformId(platformSurveyId: string): Promise<Survey> {
    const pool = database.getPool();
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM g_surveys WHERE platformSurveyId = ?',
      [platformSurveyId]
    );

    if (rows.length === 0) {
      throw new CustomError('Survey not found', 404);
    }

    const survey = {
      ...rows[0],
      triggerConditions: JSON.parse(rows[0].triggerConditions),
      participationRewards: rows[0].participationRewards ? JSON.parse(rows[0].participationRewards) : null,
    } as Survey;

    return survey;
  }

  /**
   * Create a new survey
   */
  static async createSurvey(input: CreateSurveyInput): Promise<Survey> {
    const pool = database.getPool();
    // Validate trigger conditions
    if (!input.triggerConditions || input.triggerConditions.length === 0) {
      throw new CustomError('At least one trigger condition is required', 400);
    }

    // Check if platformSurveyId already exists
    const [existing] = await pool.execute<RowDataPacket[]>(
      'SELECT id FROM g_surveys WHERE platformSurveyId = ?',
      [input.platformSurveyId]
    );

    if (existing.length > 0) {
      throw new CustomError('Platform survey ID already exists', 400);
    }

    const id = ulid();
    const isActive = input.isActive !== undefined ? input.isActive : true;

    await pool.execute(
      `INSERT INTO g_surveys 
      (id, platformSurveyId, surveyTitle, surveyContent, triggerConditions, 
       participationRewards, rewardMailTitle, rewardMailContent, isActive, createdBy)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.platformSurveyId,
        input.surveyTitle,
        input.surveyContent || null,
        JSON.stringify(input.triggerConditions),
        input.participationRewards ? JSON.stringify(input.participationRewards) : null,
        input.rewardMailTitle || null,
        input.rewardMailContent || null,
        isActive,
        input.createdBy || null,
      ]
    );

    return await this.getSurveyById(id);
  }

  /**
   * Update a survey
   */
  static async updateSurvey(id: string, input: UpdateSurveyInput): Promise<Survey> {
    const pool = database.getPool();
    // Check if survey exists
    await this.getSurveyById(id);

    // If platformSurveyId is being updated, check for duplicates
    if (input.platformSurveyId) {
      const [existing] = await pool.execute<RowDataPacket[]>(
        'SELECT id FROM g_surveys WHERE platformSurveyId = ? AND id != ?',
        [input.platformSurveyId, id]
      );

      if (existing.length > 0) {
        throw new CustomError('Platform survey ID already exists', 400);
      }
    }

    // Validate trigger conditions if provided
    if (input.triggerConditions && input.triggerConditions.length === 0) {
      throw new CustomError('At least one trigger condition is required', 400);
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (input.platformSurveyId !== undefined) {
      updates.push('platformSurveyId = ?');
      values.push(input.platformSurveyId);
    }
    if (input.surveyTitle !== undefined) {
      updates.push('surveyTitle = ?');
      values.push(input.surveyTitle);
    }
    if (input.surveyContent !== undefined) {
      updates.push('surveyContent = ?');
      values.push(input.surveyContent);
    }
    if (input.triggerConditions !== undefined) {
      updates.push('triggerConditions = ?');
      values.push(JSON.stringify(input.triggerConditions));
    }
    if (input.participationRewards !== undefined) {
      updates.push('participationRewards = ?');
      values.push(input.participationRewards ? JSON.stringify(input.participationRewards) : null);
    }
    if (input.rewardMailTitle !== undefined) {
      updates.push('rewardMailTitle = ?');
      values.push(input.rewardMailTitle);
    }
    if (input.rewardMailContent !== undefined) {
      updates.push('rewardMailContent = ?');
      values.push(input.rewardMailContent);
    }
    if (input.isActive !== undefined) {
      updates.push('isActive = ?');
      values.push(input.isActive);
    }
    if (input.updatedBy !== undefined) {
      updates.push('updatedBy = ?');
      values.push(input.updatedBy);
    }

    if (updates.length === 0) {
      throw new CustomError('No fields to update', 400);
    }

    values.push(id);

    await pool.execute(
      `UPDATE g_surveys SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    return await this.getSurveyById(id);
  }

  /**
   * Delete a survey
   */
  static async deleteSurvey(id: string): Promise<void> {
    const pool = database.getPool();
    const [result] = await pool.execute<ResultSetHeader>(
      'DELETE FROM g_surveys WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      throw new CustomError('Survey not found', 404);
    }
  }

  /**
   * Get survey configuration from g_vars
   */
  static async getSurveyConfig(): Promise<SurveyConfig> {
    const pool = database.getPool();
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT varKey, varValue FROM g_vars
       WHERE varKey IN ('survey.baseSurveyUrl', 'survey.baseJoinedUrl', 'survey.linkCaption', 'survey.joinedSecretKey')`
    );

    const config: any = {};
    rows.forEach((row: any) => {
      const key = row.varKey.replace('survey.', '');
      config[key] = row.varValue;
    });

    // Set defaults if not found
    return {
      baseSurveyUrl: config.baseSurveyUrl || 'https://survey.dw.sdo.com',
      baseJoinedUrl: config.baseJoinedUrl || 'https://survey.dw.sdo.com/survey/joined',
      linkCaption: config.linkCaption || '설문조사 참여하기',
      joinedSecretKey: config.joinedSecretKey || '123',
    };
  }

  /**
   * Update survey configuration in g_vars
   */
  static async updateSurveyConfig(input: Partial<SurveyConfig>): Promise<SurveyConfig> {
    const pool = database.getPool();
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
      throw new CustomError('No fields to update', 400);
    }

    // Update each var
    for (const update of updates) {
      await pool.execute(
        `INSERT INTO g_vars (varKey, varValue, description, createdBy)
         VALUES (?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE varValue = VALUES(varValue), updatedBy = 1`,
        [update.key, update.value, `Survey configuration: ${update.key}`]
      );
    }

    return await this.getSurveyConfig();
  }
}

