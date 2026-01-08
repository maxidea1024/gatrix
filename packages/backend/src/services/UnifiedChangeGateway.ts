import { Environment } from '../models/Environment';
import { ChangeRequest } from '../models/ChangeRequest';
import { ChangeRequestService } from './ChangeRequestService';
import logger from '../config/logger';
import knex from '../config/knex';
import { ErrorCodes } from '@gatrix/shared';
import { GatrixError } from '../middleware/errorHandler';

export type ChangeOperationType = 'create' | 'update' | 'delete';

export interface ChangeGatewayResult {
    status: 'APPLIED_IMMEDIATELY' | 'DRAFT_SAVED' | 'ITEM_LOCKED';
    mode: 'DIRECT' | 'CHANGE_REQUEST';
    data?: any; // Result data for direct operations
    changeRequestId?: string;
    error?: any;
}

export class UnifiedChangeGateway {

    /**
     * Request a modification (update) through the Change Request system
     */
    static async requestModification(
        userId: number,
        environmentName: string,
        targetTable: string,
        targetId: string,
        newData: any,
    ): Promise<ChangeGatewayResult> {
        return this.processChange(userId, environmentName, targetTable, targetId, newData);
    }

    /**
     * Request a creation through the Change Request system
     */
    static async requestCreation(
        userId: number,
        environmentName: string,
        targetTable: string,
        createData: any,
        createFunction: () => Promise<any>,
    ): Promise<ChangeGatewayResult> {
        try {
            // 1. Fetch Environment Policy
            const env = await Environment.query().findById(environmentName);
            if (!env) {
                throw new Error(`Environment '${environmentName}' not found.`);
            }

            // 2. Check if CR is required
            if (!env.requiresApproval) {
                // Direct creation
                const result = await createFunction();
                return {
                    status: 'APPLIED_IMMEDIATELY',
                    mode: 'DIRECT',
                    data: result
                };
            }

            // 3. CR Required - Create a change request for the new item
            const existingDraft = await ChangeRequest.query()
                .where('requesterId', userId)
                .where('environment', environmentName)
                .where('status', 'draft')
                .orderBy('updatedAt', 'desc')
                .first();

            const result = await ChangeRequestService.upsertChangeRequestItem(
                userId,
                environmentName,
                targetTable,
                `NEW_${Date.now()}`, // Temporary ID for new items
                null, // beforeData is null for creation (record doesn't exist yet)
                createData,
                existingDraft?.id
            );

            return {
                status: 'DRAFT_SAVED',
                changeRequestId: result.changeRequestId,
                mode: 'CHANGE_REQUEST'
            };

        } catch (error) {
            logger.error('[UnifiedChangeGateway.requestCreation] Error:', error);
            throw error;
        }
    }

    /**
     * Request a deletion through the Change Request system
     */
    static async requestDeletion(
        userId: number,
        environmentName: string,
        targetTable: string,
        targetId: string,
        deleteFunction: () => Promise<void>,
    ): Promise<ChangeGatewayResult> {
        try {
            // 1. Fetch Environment Policy
            const env = await Environment.query().findById(environmentName);
            if (!env) {
                throw new Error(`Environment '${environmentName}' not found.`);
            }

            // 2. Check for pending CR locks
            const pendingRequest = await ChangeRequest.query()
                .alias('cr')
                .join('g_change_items as ci', 'cr.id', 'ci.changeRequestId')
                .where('ci.targetTable', targetTable)
                .where('ci.targetId', targetId)
                .whereIn('cr.status', ['open', 'approved'])
                .select('cr.id', 'cr.title', 'cr.requesterId')
                .first();

            if (pendingRequest) {
                const conflictInfo = {
                    lockedBy: pendingRequest.requesterId,
                    changeRequestId: pendingRequest.id,
                    changeRequestTitle: pendingRequest.title
                };

                throw new GatrixError(
                    `This item is currently locked by active Change Request: ${pendingRequest.title}`,
                    409, // Conflict
                    true,
                    ErrorCodes.RESOURCE_LOCKED,
                    conflictInfo
                );
            }

            // 3. Check if CR is required
            if (!env.requiresApproval) {
                // Direct deletion
                await deleteFunction();
                return {
                    status: 'APPLIED_IMMEDIATELY',
                    mode: 'DIRECT'
                };
            }

            // 4. CR Required - Get current data and create deletion request
            const currentData = await knex(targetTable).where('id', targetId).first();
            if (!currentData) {
                throw new Error(`Item ${targetId} not found in ${targetTable}`);
            }

            const existingDraft = await ChangeRequest.query()
                .where('requesterId', userId)
                .where('environment', environmentName)
                .where('status', 'draft')
                .orderBy('updatedAt', 'desc')
                .first();

            const result = await ChangeRequestService.upsertChangeRequestItem(
                userId,
                environmentName,
                targetTable,
                targetId,
                currentData, // beforeData
                { __deleted: true }, // afterData marker for deletion
                existingDraft?.id
            );

            return {
                status: 'DRAFT_SAVED',
                changeRequestId: result.changeRequestId,
                mode: 'CHANGE_REQUEST'
            };

        } catch (error) {
            logger.error('[UnifiedChangeGateway.requestDeletion] Error:', error);
            throw error;
        }
    }

    /**
     * Internal method to process update changes
     */
    public static async processChange(
        userId: number,
        environmentName: string,
        targetTable: string,
        targetId: string,
        changeDataOrFunction: any | ((currentData: any) => Promise<any> | any),
        directChangeFunction?: (processedData: any) => Promise<any>
    ): Promise<ChangeGatewayResult> {
        try {
            // 1. Fetch Env Policy
            const env = await Environment.query().findById(environmentName);
            if (!env) {
                throw new Error(`Environment '${environmentName}' not found.`);
            }

            // 2. Global Lock Check
            const pendingRequest = await ChangeRequest.query()
                .alias('cr')
                .join('g_change_items as ci', 'cr.id', 'ci.changeRequestId')
                .where('ci.targetTable', targetTable)
                .where('ci.targetId', targetId)
                .whereIn('cr.status', ['open', 'approved'])
                .select('cr.id', 'cr.title', 'cr.requesterId')
                .first();

            if (pendingRequest) {
                const conflictInfo = {
                    lockedBy: pendingRequest.requesterId,
                    changeRequestId: pendingRequest.id,
                    changeRequestTitle: pendingRequest.title
                };

                throw new GatrixError(
                    `This item is currently locked by active Change Request: ${pendingRequest.title}`,
                    409, // Conflict
                    true,
                    ErrorCodes.RESOURCE_LOCKED,
                    conflictInfo
                );
            }

            // 3. Resolve New Data
            const currentData = await knex(targetTable).where('id', targetId).first();
            let newData;
            if (typeof changeDataOrFunction === 'function') {
                newData = await changeDataOrFunction(currentData);
            } else {
                newData = changeDataOrFunction;
            }

            // 4. Branching Logic
            // CASE A: Direct Update
            if (!env.requiresApproval) {
                if (!/^[a-zA-Z0-9_]+$/.test(targetTable)) throw new Error('Invalid table name');

                let result;
                if (directChangeFunction) {
                    result = await directChangeFunction(newData);
                } else {
                    await knex(targetTable)
                        .where('id', targetId)
                        .update(newData);
                    result = { id: targetId, ...newData };
                }

                return {
                    status: 'APPLIED_IMMEDIATELY',
                    mode: 'DIRECT',
                    data: result
                };
            }

            // CASE B: Change Request Required
            const existingDraft = await ChangeRequest.query()
                .where('requesterId', userId)
                .where('environment', environmentName)
                .where('status', 'draft')
                .orderBy('updatedAt', 'desc')
                .first();

            const result = await ChangeRequestService.upsertChangeRequestItem(
                userId,
                environmentName,
                targetTable,
                targetId,
                currentData || {}, // Before
                newData,             // After
                existingDraft?.id
            );

            return {
                status: 'DRAFT_SAVED',
                changeRequestId: result.changeRequestId,
                mode: 'CHANGE_REQUEST'
            };

        } catch (error) {
            logger.error('[UnifiedChangeGateway] Error:', error);
            throw error;
        }
    }

    /**
     * Check if an environment requires CR approval
     */
    static async requiresApproval(environmentName: string): Promise<boolean> {
        const env = await Environment.query().findById(environmentName);
        return env?.requiresApproval ?? false;
    }

    /**
     * Get environment CR settings
     */
    static async getEnvironmentSettings(environmentName: string): Promise<{ requiresApproval: boolean; requiredApprovers: number } | null> {
        const env = await Environment.query().findById(environmentName);
        if (!env) return null;
        return {
            requiresApproval: env.requiresApproval,
            requiredApprovers: env.requiredApprovers
        };
    }
}

