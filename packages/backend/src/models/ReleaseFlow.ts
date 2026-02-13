import db from '../config/knex';
import logger from '../config/logger';
import { ulid } from 'ulid';
import { Constraint, StrategyParameters } from './FeatureFlag';

// ==================== Types ====================

export type FlowDiscriminator = 'template' | 'plan';
export type FlowStatus = 'draft' | 'active' | 'paused' | 'completed';

export interface TransitionCondition {
    intervalMinutes: number;
}

export interface ReleaseFlowAttributes {
    id: string;
    flowName: string;
    displayName?: string;
    description?: string;
    discriminator: FlowDiscriminator;
    flagId?: string;
    environment?: string;
    activeMilestoneId?: string;
    status: FlowStatus;
    isArchived: boolean;
    archivedAt?: Date;
    createdBy: number;
    updatedBy?: number;
    createdAt?: Date;
    updatedAt?: Date;

    // Relations
    milestones?: ReleaseFlowMilestoneAttributes[];
}

export interface ReleaseFlowMilestoneAttributes {
    id: string;
    flowId: string;
    name: string;
    sortOrder: number;
    startedAt?: Date;
    transitionCondition?: TransitionCondition | null;
    progressionExecutedAt?: Date | null;
    pausedAt?: Date | null;
    createdAt?: Date;
    updatedAt?: Date;

    // Relations
    strategies?: ReleaseFlowStrategyAttributes[];
}

export interface ReleaseFlowStrategyAttributes {
    id: string;
    milestoneId: string;
    strategyName: string;
    parameters?: StrategyParameters;
    constraints?: Constraint[];
    sortOrder: number;
    createdAt?: Date;
    updatedAt?: Date;

    // Relations
    segments?: string[];
}

// ==================== Helper Functions ====================

function parseJsonField<T>(value: any): T | undefined {
    if (value === null || value === undefined || value === 'null') return undefined;
    if (typeof value === 'object') return value as T;
    try {
        const parsed = JSON.parse(value);
        if (parsed === null) return undefined;
        return parsed as T;
    } catch {
        return value as T;
    }
}

// ==================== Release Flow Model ====================

export class ReleaseFlowModel {
    static async listTemplates(search?: string): Promise<ReleaseFlowAttributes[]> {
        try {
            let query = db('g_release_flows')
                .where('discriminator', 'template')
                .where('isArchived', false);

            if (search) {
                query = query.where((qb) => {
                    qb.where('flowName', 'like', `%${search}%`)
                        .orWhere('displayName', 'like', `%${search}%`)
                        .orWhere('description', 'like', `%${search}%`);
                });
            }

            const templates = await query.orderBy('createdAt', 'desc');
            return templates.map((t: any) => ({
                ...t,
                isArchived: Boolean(t.isArchived),
                status: t.status || 'draft',
            }));
        } catch (error) {
            logger.error('Error listing release flow templates:', error);
            throw error;
        }
    }

    static async findById(id: string): Promise<ReleaseFlowAttributes | null> {
        try {
            const flow = await db('g_release_flows').where('id', id).first();
            if (!flow) return null;

            const milestones = await ReleaseFlowMilestoneModel.findByFlowId(id);

            return {
                ...flow,
                isArchived: Boolean(flow.isArchived),
                status: flow.status || 'draft',
                milestones,
            };
        } catch (error) {
            logger.error('Error finding release flow by ID:', error);
            throw error;
        }
    }

    static async findPlanByFlagAndEnv(
        flagId: string,
        environment: string
    ): Promise<ReleaseFlowAttributes | null> {
        try {
            const flow = await db('g_release_flows')
                .where('flagId', flagId)
                .where('environment', environment)
                .where('discriminator', 'plan')
                .where('isArchived', false)
                .first();

            if (!flow) return null;
            return this.findById(flow.id);
        } catch (error) {
            logger.error('Error finding release flow plan:', error);
            throw error;
        }
    }

    static async create(
        data: Omit<ReleaseFlowAttributes, 'id' | 'createdAt' | 'updatedAt' | 'milestones'>
    ): Promise<ReleaseFlowAttributes> {
        try {
            const id = ulid();
            await db('g_release_flows').insert({
                id,
                flowName: data.flowName,
                displayName: data.displayName || data.flowName,
                description: data.description || null,
                discriminator: data.discriminator,
                flagId: data.flagId || null,
                environment: data.environment || null,
                activeMilestoneId: data.activeMilestoneId || null,
                isArchived: false,
                createdBy: data.createdBy,
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            return (await this.findById(id))!;
        } catch (error) {
            logger.error('Error creating release flow:', error);
            throw error;
        }
    }

    static async update(id: string, data: Partial<ReleaseFlowAttributes>): Promise<ReleaseFlowAttributes> {
        try {
            const updateData: any = { updatedAt: new Date() };

            if (data.displayName !== undefined) updateData.displayName = data.displayName;
            if (data.description !== undefined) updateData.description = data.description;
            if (data.activeMilestoneId !== undefined) updateData.activeMilestoneId = data.activeMilestoneId;
            if (data.status !== undefined) updateData.status = data.status;
            if (data.isArchived !== undefined) updateData.isArchived = data.isArchived;
            if (data.archivedAt !== undefined) updateData.archivedAt = data.archivedAt;
            if (data.updatedBy !== undefined) updateData.updatedBy = data.updatedBy;

            await db('g_release_flows').where('id', id).update(updateData);
            return (await this.findById(id))!;
        } catch (error) {
            logger.error('Error updating release flow:', error);
            throw error;
        }
    }

    static async delete(id: string): Promise<void> {
        try {
            await db('g_release_flows').where('id', id).del();
        } catch (error) {
            logger.error('Error deleting release flow:', error);
            throw error;
        }
    }
}

// ==================== Release Flow Milestone Model ====================

export class ReleaseFlowMilestoneModel {
    static async findByFlowId(flowId: string): Promise<ReleaseFlowMilestoneAttributes[]> {
        try {
            const milestones = await db('g_release_flow_milestones')
                .where('flowId', flowId)
                .orderBy('sortOrder', 'asc');

            const result = [];
            for (const m of milestones) {
                const strategies = await ReleaseFlowStrategyModel.findByMilestoneId(m.id);
                result.push({
                    ...m,
                    transitionCondition: parseJsonField<TransitionCondition>(m.transitionCondition),
                    strategies,
                });
            }
            return result;
        } catch (error) {
            logger.error('Error finding milestones by flow ID:', error);
            throw error;
        }
    }

    static async findById(id: string): Promise<ReleaseFlowMilestoneAttributes | null> {
        try {
            const milestone = await db('g_release_flow_milestones').where('id', id).first();
            if (!milestone) return null;

            const strategies = await ReleaseFlowStrategyModel.findByMilestoneId(id);
            return {
                ...milestone,
                strategies,
            };
        } catch (error) {
            logger.error('Error finding milestone by ID:', error);
            throw error;
        }
    }

    static async create(
        data: Omit<ReleaseFlowMilestoneAttributes, 'id' | 'createdAt' | 'updatedAt' | 'strategies'>
    ): Promise<ReleaseFlowMilestoneAttributes> {
        try {
            const id = ulid();
            await db('g_release_flow_milestones').insert({
                id,
                flowId: data.flowId,
                name: data.name,
                sortOrder: data.sortOrder ?? 0,
                transitionCondition: data.transitionCondition ? JSON.stringify(data.transitionCondition) : null,
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            return (await this.findById(id))!;
        } catch (error) {
            logger.error('Error creating milestone:', error);
            throw error;
        }
    }

    static async update(
        id: string,
        data: Partial<ReleaseFlowMilestoneAttributes>
    ): Promise<ReleaseFlowMilestoneAttributes> {
        try {
            const updateData: any = { updatedAt: new Date() };
            if (data.name !== undefined) updateData.name = data.name;
            if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;
            if (data.startedAt !== undefined) updateData.startedAt = data.startedAt;
            if (data.transitionCondition !== undefined) {
                updateData.transitionCondition = data.transitionCondition
                    ? JSON.stringify(data.transitionCondition)
                    : null;
            }
            if (data.progressionExecutedAt !== undefined) updateData.progressionExecutedAt = data.progressionExecutedAt;
            if (data.pausedAt !== undefined) updateData.pausedAt = data.pausedAt;

            await db('g_release_flow_milestones').where('id', id).update(updateData);
            return (await this.findById(id))!;
        } catch (error) {
            logger.error('Error updating milestone:', error);
            throw error;
        }
    }

    static async delete(id: string): Promise<void> {
        try {
            await db('g_release_flow_milestones').where('id', id).del();
        } catch (error) {
            logger.error('Error deleting milestone:', error);
            throw error;
        }
    }

    // Find active plans with milestones ready for progression
    static async findActivePlansWithTransitions(): Promise<any[]> {
        try {
            const rows = await db('g_release_flows as f')
                .join('g_release_flow_milestones as m', 'f.activeMilestoneId', 'm.id')
                .where('f.discriminator', 'plan')
                .where('f.status', 'active')
                .where('f.isArchived', false)
                .whereNotNull('m.transitionCondition')
                .whereNotNull('m.startedAt')
                .whereNull('m.pausedAt')
                .whereNull('m.progressionExecutedAt')
                .select(
                    'f.id as flowId',
                    'f.activeMilestoneId',
                    'm.startedAt',
                    'm.transitionCondition',
                    'm.sortOrder'
                );

            return rows.map((row: any) => ({
                ...row,
                transitionCondition: parseJsonField<TransitionCondition>(row.transitionCondition),
            }));
        } catch (error) {
            logger.error('Error finding active plans with transitions:', error);
            throw error;
        }
    }
}

// ==================== Release Flow Strategy Model ====================

export class ReleaseFlowStrategyModel {
    static async findByMilestoneId(milestoneId: string): Promise<ReleaseFlowStrategyAttributes[]> {
        try {
            const strategies = await db('g_release_flow_strategies')
                .where('milestoneId', milestoneId)
                .orderBy('sortOrder', 'asc');

            const result = [];
            for (const s of strategies) {
                const segments = await this.getSegmentsForStrategy(s.id);
                result.push({
                    ...s,
                    parameters: parseJsonField<StrategyParameters>(s.parameters),
                    constraints: parseJsonField<Constraint[]>(s.constraints) || [],
                    segments,
                });
            }
            return result;
        } catch (error) {
            logger.error('Error finding strategies by milestone ID:', error);
            throw error;
        }
    }

    private static async getSegmentsForStrategy(strategyId: string): Promise<string[]> {
        const segmentLinks = await db('g_release_flow_strategy_segments')
            .where('strategyId', strategyId)
            .select('segmentId');

        const segmentNames: string[] = [];
        for (const link of segmentLinks) {
            const segment = await db('g_feature_segments').where('id', link.segmentId).first();
            if (segment) {
                segmentNames.push(segment.segmentName);
            }
        }
        return segmentNames;
    }

    static async findById(id: string): Promise<ReleaseFlowStrategyAttributes | null> {
        try {
            const strategy = await db('g_release_flow_strategies').where('id', id).first();
            if (!strategy) return null;

            const segments = await this.getSegmentsForStrategy(id);
            return {
                ...strategy,
                parameters: parseJsonField<StrategyParameters>(strategy.parameters),
                constraints: parseJsonField<Constraint[]>(strategy.constraints) || [],
                segments,
            };
        } catch (error) {
            logger.error('Error finding strategy by ID:', error);
            throw error;
        }
    }

    static async create(
        data: Omit<ReleaseFlowStrategyAttributes, 'id' | 'createdAt' | 'updatedAt' | 'segments'>
    ): Promise<ReleaseFlowStrategyAttributes> {
        try {
            const id = ulid();
            await db('g_release_flow_strategies').insert({
                id,
                milestoneId: data.milestoneId,
                strategyName: data.strategyName,
                parameters: data.parameters ? JSON.stringify(data.parameters) : null,
                constraints: data.constraints ? JSON.stringify(data.constraints) : '[]',
                sortOrder: data.sortOrder ?? 0,
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            return (await this.findById(id))!;
        } catch (error) {
            logger.error('Error creating release flow strategy:', error);
            throw error;
        }
    }

    static async delete(id: string): Promise<void> {
        try {
            await db('g_release_flow_strategies').where('id', id).del();
        } catch (error) {
            logger.error('Error deleting release flow strategy:', error);
            throw error;
        }
    }

    static async updateSegments(strategyId: string, segmentNames: string[]): Promise<void> {
        // This requires looking up segment IDs from names
        const segments = await db('g_feature_segments').whereIn('segmentName', segmentNames);
        const segmentIds = segments.map((s) => s.id);

        await db('g_release_flow_strategy_segments').where('strategyId', strategyId).del();
        if (segmentIds.length > 0) {
            const links = segmentIds.map((segmentId) => ({
                id: ulid(),
                strategyId,
                segmentId,
            }));
            await db('g_release_flow_strategy_segments').insert(links);
        }
    }
}
