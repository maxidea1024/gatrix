import db from '../config/knex';
import { GatrixError } from '../middleware/error-handler';
import { ulid } from 'ulid';

import { createLogger } from '../config/logger';
const logger = createLogger('SurveyTemplateService');

// ==================== Types ====================

export type QuestionType =
  | 'welcome'
  | 'single_choice'
  | 'multiple_choice'
  | 'short_text'
  | 'long_text'
  | 'rating'
  | 'linear_scale'
  | 'dropdown'
  | 'ending';

export interface LocalizedString {
  [locale: string]: string; // e.g. { ko: '...', en: '...', zh: '...' }
}

export interface QuestionOption {
  id: string;
  label: LocalizedString;
  value?: string;
}

export interface QuestionSettings {
  min?: number;
  max?: number;
  step?: number;
  icon?: string; // 'star' | 'heart' | 'number'
  maxLength?: number;
  maxSelections?: number;
  placeholder?: LocalizedString;
  minLabel?: LocalizedString;
  maxLabel?: LocalizedString;
}

export interface Question {
  id: string;
  type: QuestionType;
  title: LocalizedString;
  description?: LocalizedString;
  required?: boolean;
  options?: QuestionOption[];
  settings?: QuestionSettings;
}

export interface TemplateSettings {
  shuffleQuestions?: boolean;
  showProgressBar?: boolean;
  theme?: {
    primaryColor?: string;
    backgroundColor?: string;
    fontFamily?: string;
  };
}

export interface TemplateLocales {
  [locale: string]: {
    submitButton?: string;
    nextButton?: string;
    prevButton?: string;
    thankYou?: string;
    requiredError?: string;
  };
}

export interface SurveyTemplate {
  id: string;
  environmentId: string;
  title: string;
  description?: string;
  questions: Question[];
  settings?: TemplateSettings;
  locales?: TemplateLocales;
  version: number;
  isPublished: boolean;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateTemplateInput {
  environmentId: string;
  title: string;
  description?: string;
  questions: Question[];
  settings?: TemplateSettings;
  locales?: TemplateLocales;
  isPublished?: boolean;
  createdBy?: string;
}

export interface UpdateTemplateInput {
  title?: string;
  description?: string;
  questions?: Question[];
  settings?: TemplateSettings;
  locales?: TemplateLocales;
  isPublished?: boolean;
  updatedBy?: string;
}

// ==================== Helpers ====================

function parseJsonField<T>(value: any, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  return value as T;
}

function rowToTemplate(row: any): SurveyTemplate {
  return {
    ...row,
    questions: parseJsonField<Question[]>(row.questions, []),
    settings: parseJsonField<TemplateSettings | undefined>(
      row.settings,
      undefined
    ),
    locales: parseJsonField<TemplateLocales | undefined>(
      row.locales,
      undefined
    ),
    isPublished: !!row.isPublished,
  };
}

// ==================== Service ====================

export class SurveyTemplateService {
  /**
   * List templates with pagination
   */
  static async getTemplates(params: {
    environmentId: string;
    page?: number;
    limit?: number;
    isPublished?: boolean;
    search?: string;
  }): Promise<{
    templates: SurveyTemplate[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const offset = (page - 1) * limit;

    let query = db('g_survey_templates').where(
      'environmentId',
      params.environmentId
    );
    let countQuery = db('g_survey_templates').where(
      'environmentId',
      params.environmentId
    );

    if (params.isPublished !== undefined) {
      query = query.where('isPublished', params.isPublished);
      countQuery = countQuery.where('isPublished', params.isPublished);
    }

    if (params.search) {
      const term = `%${params.search}%`;
      query = query.where(function () {
        this.where('title', 'like', term).orWhere(
          'description',
          'like',
          term
        );
      });
      countQuery = countQuery.where(function () {
        this.where('title', 'like', term).orWhere(
          'description',
          'like',
          term
        );
      });
    }

    const countResult = await countQuery.count('* as total').first();
    const total = (countResult?.total as number) || 0;

    const rows = await query
      .orderBy('updatedAt', 'desc')
      .limit(limit)
      .offset(offset);

    const templates = rows.map(rowToTemplate);

    return { templates, total, page, limit };
  }

  /**
   * Get a single template by ID
   */
  static async getTemplateById(
    id: string,
    environmentId: string
  ): Promise<SurveyTemplate> {
    const row = await db('g_survey_templates')
      .where({ id, environmentId })
      .first();

    if (!row) {
      throw new GatrixError('Survey template not found', 404);
    }

    return rowToTemplate(row);
  }

  /**
   * Create a new template
   */
  static async createTemplate(
    input: CreateTemplateInput
  ): Promise<SurveyTemplate> {
    const id = ulid();

    const record = {
      id,
      environmentId: input.environmentId,
      title: input.title,
      description: input.description || null,
      questions: JSON.stringify(input.questions || []),
      settings: input.settings ? JSON.stringify(input.settings) : null,
      locales: input.locales ? JSON.stringify(input.locales) : null,
      version: 1,
      isPublished: input.isPublished ? 1 : 0,
      createdBy: input.createdBy || null,
      updatedBy: input.createdBy || null,
    };

    await db('g_survey_templates').insert(record);

    return this.getTemplateById(id, input.environmentId);
  }

  /**
   * Update a template
   */
  static async updateTemplate(
    id: string,
    input: UpdateTemplateInput,
    environmentId: string
  ): Promise<SurveyTemplate> {
    const existing = await this.getTemplateById(id, environmentId);

    const updateData: any = {};
    if (input.title !== undefined) updateData.title = input.title;
    if (input.description !== undefined)
      updateData.description = input.description;
    if (input.questions !== undefined)
      updateData.questions = JSON.stringify(input.questions);
    if (input.settings !== undefined)
      updateData.settings = JSON.stringify(input.settings);
    if (input.locales !== undefined)
      updateData.locales = JSON.stringify(input.locales);
    if (input.isPublished !== undefined)
      updateData.isPublished = input.isPublished ? 1 : 0;
    if (input.updatedBy !== undefined) updateData.updatedBy = input.updatedBy;

    // Bump version if questions changed
    if (input.questions !== undefined) {
      updateData.version = existing.version + 1;
    }

    if (Object.keys(updateData).length > 0) {
      await db('g_survey_templates')
        .where({ id, environmentId })
        .update(updateData);
    }

    return this.getTemplateById(id, environmentId);
  }

  /**
   * Delete a template
   */
  static async deleteTemplate(
    id: string,
    environmentId: string
  ): Promise<void> {
    // Check for active surveys using this template
    const linkedSurveys = await db('g_surveys')
      .where({ templateId: id, environmentId })
      .count('* as count')
      .first();

    if (linkedSurveys && (linkedSurveys.count as number) > 0) {
      throw new GatrixError(
        'Cannot delete template that is linked to active surveys. Unlink or delete the surveys first.',
        409
      );
    }

    const deleted = await db('g_survey_templates')
      .where({ id, environmentId })
      .delete();

    if (!deleted) {
      throw new GatrixError('Survey template not found', 404);
    }
  }

  /**
   * Duplicate a template
   */
  static async duplicateTemplate(
    id: string,
    environmentId: string,
    createdBy?: string
  ): Promise<SurveyTemplate> {
    const source = await this.getTemplateById(id, environmentId);

    return this.createTemplate({
      environmentId,
      title: `${source.title} (Copy)`,
      description: source.description,
      questions: source.questions,
      settings: source.settings,
      locales: source.locales,
      isPublished: false, // always start as draft
      createdBy,
    });
  }

  // ==================== Response Service ====================

  /**
   * Submit a survey response (for CUSTOM surveys)
   */
  static async submitResponse(input: {
    environmentId: string;
    surveyId: string;
    templateId: string;
    templateVersion: number;
    accountId: string;
    characterId?: string;
    worldId?: string;
    locale?: string;
    answers: Record<string, any>;
  }): Promise<{ id: string }> {
    const id = ulid();

    await db('g_survey_responses').insert({
      id,
      environmentId: input.environmentId,
      surveyId: input.surveyId,
      templateId: input.templateId,
      templateVersion: input.templateVersion,
      accountId: input.accountId,
      characterId: input.characterId || null,
      worldId: input.worldId || null,
      locale: input.locale || null,
      answers: JSON.stringify(input.answers),
    });

    return { id };
  }

  /**
   * Check if a user has already responded to a survey
   */
  static async hasResponded(
    surveyId: string,
    accountId: string
  ): Promise<boolean> {
    const row = await db('g_survey_responses')
      .where({ surveyId, accountId })
      .first();
    return !!row;
  }

  /**
   * Get responses for a survey with pagination
   */
  static async getResponses(params: {
    environmentId: string;
    surveyId: string;
    page?: number;
    limit?: number;
  }): Promise<{
    responses: any[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = params.page || 1;
    const limit = params.limit || 50;
    const offset = (page - 1) * limit;

    const countResult = await db('g_survey_responses')
      .where({
        environmentId: params.environmentId,
        surveyId: params.surveyId,
      })
      .count('* as total')
      .first();
    const total = (countResult?.total as number) || 0;

    const rows = await db('g_survey_responses')
      .where({
        environmentId: params.environmentId,
        surveyId: params.surveyId,
      })
      .orderBy('completedAt', 'desc')
      .limit(limit)
      .offset(offset);

    const responses = rows.map((row: any) => ({
      ...row,
      answers: parseJsonField(row.answers, {}),
    }));

    return { responses, total, page, limit };
  }

  /**
   * Get aggregate statistics for a survey's responses
   */
  static async getResponseStats(
    surveyId: string,
    environmentId: string
  ): Promise<{
    totalResponses: number;
    questionStats: Record<string, any>;
  }> {
    const countResult = await db('g_survey_responses')
      .where({ surveyId, environmentId })
      .count('* as total')
      .first();
    const totalResponses = (countResult?.total as number) || 0;

    // Get all answers to compute per-question stats
    const rows = await db('g_survey_responses')
      .where({ surveyId, environmentId })
      .select('answers');

    const questionStats: Record<string, any> = {};

    for (const row of rows) {
      const answers = parseJsonField<Record<string, any>>(row.answers, {});
      for (const [qId, answer] of Object.entries(answers)) {
        if (!questionStats[qId]) {
          questionStats[qId] = { count: 0, values: {} };
        }
        questionStats[qId].count++;

        const key = String(answer);
        questionStats[qId].values[key] =
          (questionStats[qId].values[key] || 0) + 1;
      }
    }

    return { totalResponses, questionStats };
  }
}
