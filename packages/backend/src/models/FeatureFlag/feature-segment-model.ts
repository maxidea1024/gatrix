import db from '../../config/knex';
import { createLogger } from '../../config/logger';

const logger = createLogger('FeatureSegmentModel');
import { ulid } from 'ulid';
import { parseJsonField } from '../../utils/db-utils';
import { FeatureSegmentAttributes, Constraint } from './types';

export class FeatureSegmentModel {
  /**
   * Find all segments filtered by project
   */
  static async findAll(search?: string, projectId?: string): Promise<FeatureSegmentAttributes[]> {
    try {
      let query = db('g_feature_segments')
        .select(
          'g_feature_segments.*',
          'g_users.name as createdByName',
          'g_users.email as createdByEmail',
          db.raw(
            `(SELECT COUNT(DISTINCT ffs.strategyId) FROM g_feature_flag_segments ffs WHERE ffs.segmentId = g_feature_segments.id) as referenceCount`
          )
        )
        .leftJoin('g_users', 'g_feature_segments.createdBy', 'g_users.id');

      if (projectId) {
        query = query.where('g_feature_segments.projectId', projectId);
      }

      if (search) {
        query = query.where((qb: any) => {
          qb.where('g_feature_segments.segmentName', 'like', `%${search}%`)
            .orWhere('g_feature_segments.displayName', 'like', `%${search}%`)
            .orWhere('g_feature_segments.description', 'like', `%${search}%`);
        });
      }

      const segments = await query.orderBy('g_feature_segments.createdAt', 'desc');

      return segments.map((s: any) => ({
        ...s,
        isActive: Boolean(s.isActive),
        constraints: parseJsonField<Constraint[]>(s.constraints) || [],
        tags: parseJsonField<string[]>(s.tags) || [],
        referenceCount: Number(s.referenceCount) || 0,
      }));
    } catch (error) {
      logger.error('Error finding segments:', error);
      throw error;
    }
  }

  static async findById(id: string): Promise<FeatureSegmentAttributes | null> {
    try {
      const segment = await db('g_feature_segments').where('id', id).first();
      if (!segment) return null;

      return {
        ...segment,
        isActive: Boolean(segment.isActive),
        constraints: parseJsonField<Constraint[]>(segment.constraints) || [],
        tags: parseJsonField<string[]>(segment.tags) || [],
      };
    } catch (error) {
      logger.error('Error finding segment by ID:', error);
      throw error;
    }
  }

  /**
   * Find segment by name (now global, no environment filter)
   */
  static async findByName(segmentName: string): Promise<FeatureSegmentAttributes | null> {
    try {
      const segment = await db('g_feature_segments').where('segmentName', segmentName).first();
      if (!segment) return null;

      return {
        ...segment,
        isActive: Boolean(segment.isActive),
        constraints: parseJsonField<Constraint[]>(segment.constraints) || [],
        tags: parseJsonField<string[]>(segment.tags) || [],
      };
    } catch (error) {
      logger.error('Error finding segment by name:', error);
      throw error;
    }
  }

  /**
   * Find segments by names (for bulk fetch)
   * @param projectId - When provided, restricts lookup to this project only
   */
  static async findByNames(
    segmentNames: string[],
    projectId?: string
  ): Promise<FeatureSegmentAttributes[]> {
    try {
      if (segmentNames.length === 0) return [];

      let query = db('g_feature_segments').whereIn('segmentName', segmentNames);
      if (projectId) {
        query = query.where('projectId', projectId);
      }
      const segments = await query;

      return segments.map((s: any) => ({
        ...s,
        isActive: Boolean(s.isActive),
        constraints: parseJsonField<Constraint[]>(s.constraints) || [],
        tags: parseJsonField<string[]>(s.tags) || [],
      }));
    } catch (error) {
      logger.error('Error finding segments by names:', error);
      throw error;
    }
  }

  static async create(
    data: Omit<FeatureSegmentAttributes, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<FeatureSegmentAttributes> {
    try {
      const id = ulid();
      await db('g_feature_segments').insert({
        id,
        projectId: (data as any).projectId,
        segmentName: data.segmentName,
        displayName: data.displayName || data.segmentName,
        description: data.description || null,
        constraints: JSON.stringify(data.constraints),
        isActive: data.isActive ?? true,
        tags: data.tags ? JSON.stringify(data.tags) : null,
        createdBy: data.createdBy,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      return this.findById(id) as Promise<FeatureSegmentAttributes>;
    } catch (error) {
      logger.error('Error creating segment:', error);
      throw error;
    }
  }

  static async update(
    id: string,
    data: Partial<FeatureSegmentAttributes>
  ): Promise<FeatureSegmentAttributes> {
    try {
      const updateData: any = { updatedAt: new Date() };

      if (data.displayName !== undefined) updateData.displayName = data.displayName;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.constraints !== undefined) updateData.constraints = JSON.stringify(data.constraints);
      if (data.isActive !== undefined) updateData.isActive = data.isActive;
      if (data.tags !== undefined) updateData.tags = JSON.stringify(data.tags);
      if (data.updatedBy !== undefined) updateData.updatedBy = data.updatedBy;

      await db('g_feature_segments').where('id', id).update(updateData);

      return this.findById(id) as Promise<FeatureSegmentAttributes>;
    } catch (error) {
      logger.error('Error updating segment:', error);
      throw error;
    }
  }

  static async delete(id: string): Promise<void> {
    try {
      await db('g_feature_segments').where('id', id).del();
    } catch (error) {
      logger.error('Error deleting segment:', error);
      throw error;
    }
  }

  static async getUsageCount(id: string): Promise<number> {
    try {
      const result = await db('g_feature_flag_segments')
        .where('segmentId', id)
        .count('* as count')
        .first();
      return Number(result?.count) || 0;
    } catch (error) {
      logger.error('Error getting segment usage count:', error);
      throw error;
    }
  }

  /**
   * Get detailed references for a segment (flags and release templates that use it)
   */
  static async getReferences(id: string): Promise<{
    flags: { flagName: string; environmentId: string; strategyName: string }[];
    templates: { flowName: string; id: string; milestoneName: string }[];
  }> {
    try {
      // Find feature flags referencing this segment via strategies
      const flagRows = await db('g_feature_flag_segments as ffs')
        .join('g_feature_strategies as fs', 'ffs.strategyId', 'fs.id')
        .join('g_feature_flags as ff', 'fs.flagId', 'ff.id')
        .where('ffs.segmentId', id)
        .where('ff.isArchived', false)
        .select('ff.flagName', 'fs.environmentId', 'fs.strategyName')
        .groupBy('ff.flagName', 'fs.environmentId', 'fs.strategyName');

      // Find release flow templates referencing this segment
      const templateRows = await db('g_release_flow_strategy_segments as rss')
        .join('g_release_flow_strategies as rs', 'rss.strategyId', 'rs.id')
        .join('g_release_flow_milestones as rm', 'rs.milestoneId', 'rm.id')
        .join('g_release_flows as rf', 'rm.flowId', 'rf.id')
        .where('rss.segmentId', id)
        .where('rf.discriminator', 'template')
        .where('rf.isArchived', false)
        .select('rf.flowName', 'rf.id', 'rm.name as milestoneName')
        .groupBy('rf.flowName', 'rf.id', 'rm.name');

      return {
        flags: flagRows.map((r: any) => ({
          flagName: r.flagName,
          environmentId: r.environmentId,
          strategyName: r.strategyName,
        })),
        templates: templateRows.map((r: any) => ({
          flowName: r.flowName,
          id: r.id,
          milestoneName: r.milestoneName,
        })),
      };
    } catch (error) {
      logger.error('Error getting segment references:', error);
      throw error;
    }
  }
}
