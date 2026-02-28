import db from '../../config/knex';
import logger from '../../config/logger';
import { ulid } from 'ulid';
import { parseJsonField } from '../../utils/dbUtils';
import { ValidationRules, FeatureContextFieldAttributes, Constraint } from './types';

export class FeatureContextFieldModel {
  static async findAll(search?: string, projectId?: string): Promise<FeatureContextFieldAttributes[]> {
    try {
      let query = db('g_feature_context_fields')
        .select(
          'g_feature_context_fields.*',
          'g_users.name as createdByName',
          'g_users.email as createdByEmail'
        )
        .leftJoin('g_users', 'g_feature_context_fields.createdBy', 'g_users.id');

      if (projectId) {
        query = query.where('g_feature_context_fields.projectId', projectId);
      }

      if (search) {
        query = query.where((qb: any) => {
          qb.where('g_feature_context_fields.fieldName', 'like', `%${search}%`).orWhere(
            'g_feature_context_fields.description',
            'like',
            `%${search}%`
          );
        });
      }

      const fields = await query.orderBy('g_feature_context_fields.createdAt', 'desc');

      // Compute reference counts by scanning strategy constraints
      const strategies = await db('g_feature_strategies')
        .whereNotNull('constraints')
        .where('constraints', '!=', '[]')
        .select('constraints');

      const segments = await db('g_feature_segments')
        .whereNotNull('constraints')
        .where('constraints', '!=', '[]')
        .select('constraints');

      // Count references per field name
      const refCounts: Record<string, number> = {};
      const allConstraintSets = [...strategies, ...segments];
      for (const row of allConstraintSets) {
        const constraints = parseJsonField<any[]>(row.constraints) || [];
        for (const c of constraints) {
          if (c.contextName) {
            refCounts[c.contextName] = (refCounts[c.contextName] || 0) + 1;
          }
        }
      }

      return fields.map((f: any) => ({
        ...f,
        stickiness: Boolean(f.stickiness),
        validationRules: parseJsonField<ValidationRules>(f.validationRules) || undefined,
        tags: parseJsonField<string[]>(f.tags) || [],
        referenceCount: refCounts[f.fieldName] || 0,
      }));
    } catch (error) {
      logger.error('Error finding context fields:', error);
      throw error;
    }
  }

  static async findByFieldName(fieldName: string): Promise<FeatureContextFieldAttributes | null> {
    try {
      const field = await db('g_feature_context_fields').where('fieldName', fieldName).first();
      if (!field) return null;

      return {
        ...field,
        stickiness: Boolean(field.stickiness),
        validationRules: parseJsonField<ValidationRules>(field.validationRules) || undefined,
        tags: parseJsonField<string[]>(field.tags) || [],
      };
    } catch (error) {
      logger.error('Error finding context field:', error);
      throw error;
    }
  }

  static async create(
    data: Omit<FeatureContextFieldAttributes, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<FeatureContextFieldAttributes> {
    try {
      const id = ulid();
      await db('g_feature_context_fields').insert({
        id,
        projectId: (data as any).projectId,
        fieldName: data.fieldName,
        fieldType: data.fieldType,
        displayName: data.displayName || null,
        description: data.description || null,
        validationRules: data.validationRules ? JSON.stringify(data.validationRules) : null,
        tags: data.tags ? JSON.stringify(data.tags) : null,
        stickiness: data.stickiness ?? false,
        sortOrder: data.sortOrder ?? 0,
        createdBy: data.createdBy,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      return this.findByFieldName(data.fieldName) as Promise<FeatureContextFieldAttributes>;
    } catch (error) {
      logger.error('Error creating context field:', error);
      throw error;
    }
  }

  static async update(
    fieldName: string,
    data: Partial<FeatureContextFieldAttributes>
  ): Promise<FeatureContextFieldAttributes> {
    try {
      const updateData: any = { updatedAt: new Date() };

      if (data.fieldType !== undefined) updateData.fieldType = data.fieldType;
      if (data.displayName !== undefined) updateData.displayName = data.displayName;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.validationRules !== undefined)
        updateData.validationRules = data.validationRules
          ? JSON.stringify(data.validationRules)
          : null;
      if (data.tags !== undefined) updateData.tags = JSON.stringify(data.tags);
      if (data.stickiness !== undefined) updateData.stickiness = data.stickiness;
      if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;
      if (data.isEnabled !== undefined) updateData.isEnabled = data.isEnabled;
      if (data.updatedBy !== undefined) updateData.updatedBy = data.updatedBy;

      await db('g_feature_context_fields').where('fieldName', fieldName).update(updateData);

      return this.findByFieldName(fieldName) as Promise<FeatureContextFieldAttributes>;
    } catch (error) {
      logger.error('Error updating context field:', error);
      throw error;
    }
  }

  static async delete(fieldName: string): Promise<void> {
    try {
      await db('g_feature_context_fields').where('fieldName', fieldName).del();
    } catch (error) {
      logger.error('Error deleting context field:', error);
      throw error;
    }
  }

  /**
   * Get detailed references for a context field
   * Searches strategy constraints, segment constraints, and release template strategy constraints
   */
  static async getReferences(fieldName: string): Promise<{
    flags: { flagName: string; environmentId: string; strategyName: string }[];
    segments: { segmentName: string; id: string }[];
    templates: { flowName: string; id: string; milestoneName: string }[];
  }> {
    try {
      // Find feature flags referencing this context field in strategy constraints
      const flagRows = await db('g_feature_strategies as fs')
        .join('g_feature_flags as ff', 'fs.flagId', 'ff.id')
        .where('ff.isArchived', false)
        .whereNotNull('fs.constraints')
        .where('fs.constraints', '!=', '[]')
        .whereRaw(`JSON_SEARCH(fs.constraints, 'one', ?, NULL, '$[*].contextName') IS NOT NULL`, [
          fieldName,
        ])
        .select('ff.flagName', 'fs.environmentId', 'fs.strategyName')
        .groupBy('ff.flagName', 'fs.environmentId', 'fs.strategyName');

      // Find segments referencing this context field in their constraints
      const segmentRows = await db('g_feature_segments')
        .whereNotNull('constraints')
        .where('constraints', '!=', '[]')
        .whereRaw(`JSON_SEARCH(constraints, 'one', ?, NULL, '$[*].contextName') IS NOT NULL`, [
          fieldName,
        ])
        .select('segmentName', 'id');

      // Find release flow templates referencing this context field in strategy constraints
      const templateRows = await db('g_release_flow_strategies as rs')
        .join('g_release_flow_milestones as rm', 'rs.milestoneId', 'rm.id')
        .join('g_release_flows as rf', 'rm.flowId', 'rf.id')
        .where('rf.discriminator', 'template')
        .where('rf.isArchived', false)
        .whereNotNull('rs.constraints')
        .where('rs.constraints', '!=', '[]')
        .whereRaw(`JSON_SEARCH(rs.constraints, 'one', ?, NULL, '$[*].contextName') IS NOT NULL`, [
          fieldName,
        ])
        .select('rf.flowName', 'rf.id', 'rm.name as milestoneName')
        .groupBy('rf.flowName', 'rf.id', 'rm.name');

      return {
        flags: flagRows.map((r: any) => ({
          flagName: r.flagName,
          environmentId: r.environmentId,
          strategyName: r.strategyName,
        })),
        segments: segmentRows.map((r: any) => ({
          segmentName: r.segmentName,
          id: r.id,
        })),
        templates: templateRows.map((r: any) => ({
          flowName: r.flowName,
          id: r.id,
          milestoneName: r.milestoneName,
        })),
      };
    } catch (error) {
      logger.error('Error getting context field references:', error);
      throw error;
    }
  }
}
