import { transaction } from 'objection';
import { ulid } from 'ulid';
import { ChangeRequest, ChangeRequestStatus } from '../models/ChangeRequest';
import { ChangeItem } from '../models/ChangeItem';
import { Approval } from '../models/Approval';
import { Environment } from '../models/Environment';
import { User } from '../models/User';
import { ActionGroup, ACTION_GROUP_TYPES, ActionGroupType } from '../models/ActionGroup';
import logger from '../config/logger';
import knex from '../config/knex';
import { ChangeRequestNotifications } from './sseNotificationService';
import { GatrixError } from '../middleware/errorHandler';
import { ErrorCodes } from '@gatrix/shared';
import { diff } from 'deep-diff';
import { OutboxService } from './OutboxService';

export class ChangeRequestService {
    /**
     * Upsert a Draft Change Request or Add Item to Existing Draft
     * If a draft exists for (user + env + title?), reuse it? 
     * Simplification: Always create new or explicitly target existing by ID.
     * This method assumes creating a NEW request or updating known one.
     */
    static async upsertChangeRequestItem(
        userId: number,
        environmentName: string,
        targetTable: string,
        targetId: string,
        beforeData: Record<string, any> | null,
        afterData: Record<string, any>, // This is the proposed change
        changeRequestId?: string
    ): Promise<{ changeRequestId: string; status: ChangeRequestStatus }> {
        try {
            let cr: ChangeRequest | undefined;

            // 1. If ID provided, verify it exists and is in DRAFT
            if (changeRequestId) {
                cr = await ChangeRequest.query()
                    .findById(changeRequestId)
                    .where('status', 'draft');

                if (!cr) {
                    throw new Error('Change Request not found or not in DRAFT status.');
                }
            } else {
                // 2. Create new Draft CR
                // Generate a more readable title
                const cleanTable = targetTable.startsWith('g_') ? targetTable.slice(2) : targetTable;
                const isNew = targetId.startsWith('NEW_');

                // Try to find a human-readable identifier in the data
                const identifier = afterData?.name || afterData?.title || afterData?.displayName || afterData?.worldId || afterData?.id || (isNew ? 'New Item' : targetId);
                const action = isNew ? 'Create' : 'Update';

                cr = await ChangeRequest.query().insert({
                    id: ulid(),
                    requesterId: userId,
                    environment: environmentName,
                    status: 'draft',
                    title: `[${cleanTable}] ${action}: ${identifier}`,
                    priority: 'medium',
                    category: 'general'
                });
            }

            // 3. Upsert Change Item
            // Check if item for this target already exists in this CR
            const existingItem = await ChangeItem.query()
                .where('changeRequestId', cr.id)
                .where('targetTable', targetTable)
                .where('targetId', targetId)
                .first();

            // For UPDATE operations, merge afterData with beforeData to ensure full object
            // This prevents showing unchanged fields as "deleted" when only partial data is sent
            let mergedAfterData = afterData;
            const isNew = targetId.startsWith('NEW_');
            const isDelete = afterData === null || (afterData && Object.keys(afterData).length === 0 && beforeData) || (afterData && afterData.__deleted === true);

            if (!isNew && !isDelete && beforeData && afterData) {
                // Merge: start with beforeData, overlay with afterData changes
                mergedAfterData = { ...beforeData, ...afterData };
            }

            if (existingItem) {
                await ChangeItem.query()
                    .findById(existingItem.id)
                    .patch({
                        afterData: mergedAfterData, // Update with merged data
                        beforeData: beforeData // Update baseline if needed
                    });
            } else {
                // Determine ActionGroup type based on operation (using already computed isNew/isDelete)
                let actionType: ActionGroupType;
                if (isNew) {
                    actionType = ACTION_GROUP_TYPES.CREATE_ENTITY;
                } else if (isDelete) {
                    actionType = ACTION_GROUP_TYPES.DELETE_ENTITY;
                } else {
                    actionType = ACTION_GROUP_TYPES.UPDATE_ENTITY;
                }

                // Find or create ActionGroup for this table + actionType combination
                let actionGroup = await ActionGroup.query()
                    .where('changeRequestId', cr.id)
                    .where('actionType', actionType)
                    .first();

                if (!actionGroup) {
                    const cleanTable = targetTable.startsWith('g_') ? targetTable.slice(2) : targetTable;
                    const actionLabel = isNew ? 'Create' : isDelete ? 'Delete' : 'Update';
                    const maxOrder = await ActionGroup.query()
                        .where('changeRequestId', cr.id)
                        .max('orderIndex as maxOrder')
                        .first();
                    const nextOrder = ((maxOrder as any)?.maxOrder ?? -1) + 1;

                    actionGroup = await ActionGroup.query().insert({
                        id: ulid(),
                        changeRequestId: cr.id,
                        actionType,
                        title: `${actionLabel} ${cleanTable}`,
                        orderIndex: nextOrder,
                    });
                }

                // Insert ChangeItem with ActionGroup reference (using mergedAfterData)
                await ChangeItem.query().insert({
                    id: ulid(),
                    changeRequestId: cr.id,
                    actionGroupId: actionGroup.id,
                    targetTable,
                    targetId,
                    beforeData,
                    afterData: mergedAfterData
                });
            }

            // 4. Update Title Dynamically if more than one item
            const items = await ChangeItem.query().where('changeRequestId', cr.id);
            if (items.length > 1) {
                const user = await User.query().findById(userId);
                const lang = user?.preferredLanguage || 'en';

                const tables = [...new Set(items.map(i => i.targetTable))];
                const cleanTables = tables.map(t => t.startsWith('g_') ? t.slice(2) : t);

                let newTitle = '';
                if (tables.length === 1) {
                    const table = cleanTables[0];
                    const count = items.length;

                    // Localization
                    if (lang === 'ko') {
                        newTitle = `[${table}] ${count}개 항목`;
                    } else if (lang === 'zh') {
                        newTitle = `[${table}] ${count} 个项目`;
                    } else {
                        newTitle = `[${table}] ${count} items`;
                    }
                } else {
                    const count = items.length;
                    // Localization
                    if (lang === 'ko') {
                        newTitle = `복합 변경 (${count}개 항목)`;
                    } else if (lang === 'zh') {
                        newTitle = `混合变更 (${count} 个项目)`;
                    } else {
                        newTitle = `Mixed Changes (${count} items)`;
                    }
                }

                // Only update if current title seems like a default one (starts with [Table])
                // or contains the old default "Change Request for"
                if (cr.title.startsWith('[') || cr.title.includes('Change Request for') || cr.title.startsWith('Mixed Changes') || cr.title.startsWith('복합 변경') || cr.title.startsWith('混合变更')) {
                    await ChangeRequest.query().findById(cr.id).patch({ title: newTitle });
                }
            }

            return { changeRequestId: cr.id, status: cr.status };

        } catch (error) {
            logger.error('[ChangeRequestService] Error upserting change request:', error);
            throw error;
        }
    }

    static async updateChangeRequestMetadata(
        changeRequestId: string,
        metadata: {
            title?: string;
            description?: string;
            reason?: string;
            impactAnalysis?: string;
            priority?: 'low' | 'medium' | 'high' | 'critical';
            category?: string;
        }
    ): Promise<ChangeRequest> {
        const cr = await ChangeRequest.query().findById(changeRequestId);
        if (!cr) throw new Error('Change Request not found');
        if (cr.status !== 'draft') throw new Error('Metadata can only be updated in DRAFT status');

        return await cr.$query().patchAndFetch(metadata);
    }

    static async submitChangeRequest(changeRequestId: string): Promise<ChangeRequest> {
        const cr = await ChangeRequest.query()
            .findById(changeRequestId)
            .withGraphFetched('[requester, changeItems]');
        if (!cr) throw new Error('Change Request not found');
        if (cr.status !== 'draft') throw new Error('Only DRAFT requests can be submitted');

        // Validation - only title is required
        if (!cr.title) {
            throw new Error('Title is required for submission.');
        }

        // Capture entity versions at submission time for conflict detection later
        for (const item of (cr.changeItems || [])) {
            if (!/^[a-zA-Z0-9_]+$/.test(item.targetTable)) continue;

            // Skip new items (they have no existing version)
            if (item.targetId.startsWith('NEW_')) continue;

            try {
                const currentData = await knex(item.targetTable)
                    .where('id', item.targetId)
                    .first();

                if (currentData && typeof currentData.version === 'number') {
                    // Store the version at submission time
                    await ChangeItem.query()
                        .findById(item.id)
                        .patch({ entityVersion: currentData.version });
                }
            } catch (err) {
                logger.warn(`[ChangeRequest] Failed to capture version for ${item.targetTable}:${item.targetId}`, err);
            }
        }

        const updated = await cr.$query().patchAndFetch({
            status: 'open',
            updatedAt: new Date().toISOString() as any
        });

        // Send SSE notification to all users
        await ChangeRequestNotifications.notifySubmitted({
            id: cr.id,
            title: cr.title,
            environment: cr.environment,
            requesterId: cr.requesterId,
            requesterName: cr.requester?.name || cr.requester?.email,
        });

        return updated;
    }

    static async approveChangeRequest(changeRequestId: string, approverId: number, comment?: string): Promise<ChangeRequest> {
        return await transaction(ChangeRequest.knex(), async (trx) => {
            const cr = await ChangeRequest.query(trx).findById(changeRequestId).withGraphFetched('[environmentModel, requester]');
            if (!cr) throw new GatrixError('Change Request not found', 404, true, ErrorCodes.CR_NOT_FOUND);
            if (cr.status !== 'open') throw new GatrixError('Request is not OPEN for approval', 400, true, ErrorCodes.CR_INVALID_STATUS);

            // Get approver info for notification
            const approver = await User.query().findById(approverId);

            // 1. Record Approval
            // Check if already approved by this user
            const existing = await Approval.query(trx)
                .where('changeRequestId', changeRequestId)
                .where('approverId', approverId)
                .first();

            if (existing) {
                throw new GatrixError('You have already approved this request.', 400, true, ErrorCodes.CR_ALREADY_APPROVED);
            }

            await Approval.query(trx).insert({
                id: ulid(),
                changeRequestId: cr.id,
                approverId,
                comment
            });

            // 2. Check Threshold
            // Fetch all approvals to be absolutely sure of the count regardless of DB dialect
            const allApprovals = await Approval.query(trx).where('changeRequestId', changeRequestId);
            const currentApprovals = allApprovals.length;

            // Get required threshold from environment (default to 1)
            let requiredApprovers = 1;
            if (cr.environmentModel) {
                requiredApprovers = Number(cr.environmentModel.requiredApprovers);
            } else {
                // Fallback: fetch environment directly if relation failed to load
                const env = await knex('g_environments').transacting(trx).where('environment', cr.environment).first();
                if (env) {
                    requiredApprovers = Number(env.requiredApprovers);
                }
            }

            logger.info(`[ChangeRequest] Approval threshold check for ${cr.id}: ${currentApprovals}/${requiredApprovers} (Env: ${cr.environment})`);

            if (currentApprovals >= requiredApprovers) {
                const updated = await ChangeRequest.query(trx).patchAndFetchById(cr.id, {
                    status: 'approved',
                    updatedAt: new Date().toISOString() as any
                });

                logger.info(`[ChangeRequest] Request ${cr.id} transitioned to APPROVED status.`);

                // Send SSE notification to requester when approved
                await ChangeRequestNotifications.notifyApproved({
                    id: cr.id,
                    title: cr.title,
                    environment: cr.environment,
                    requesterId: cr.requesterId,
                }, approver?.name || approver?.email, approverId);

                return updated;
            }


            // Still OPEN - but we should return the latest state including the new approval count
            const refreshed = await ChangeRequest.query(trx)
                .findById(cr.id)
                .withGraphFetched('[environmentModel, requester, approvals]');

            return refreshed || cr;
        });
    }

    /**
     * Checks if an open Change Request meets the approval criteria
     * (Useful if environment config changes after CR creation)
     */
    static async checkAndAutoApprove(cr: ChangeRequest): Promise<ChangeRequest | null> {
        if (cr.status !== 'open') return null;

        const effectiveMinApprovals = cr.environmentModel ? Number(cr.environmentModel.requiredApprovers) : 1;
        const approvalCount = cr.approvals?.length ?? 0;

        if (approvalCount >= effectiveMinApprovals) {
            logger.info(`[ChangeRequest] Auto-approving ${cr.id} as threshold ${effectiveMinApprovals} is met via lazy check`);

            const updated = await ChangeRequest.query().patchAndFetchById(cr.id, {
                status: 'approved',
                updatedAt: new Date().toISOString() as any
            });

            // Notify about this state change
            try {
                await ChangeRequestNotifications.notifyApproved({
                    id: cr.id,
                    title: cr.title,
                    environment: cr.environment,
                    requesterId: cr.requesterId,
                }, 'System (Auto)', 0);
            } catch (err) {
                logger.error('[ChangeRequest] Failed to send auto-approve notification', err);
            }

            return updated;
        }

        return null;
    }

    static async rejectChangeRequest(changeRequestId: string, rejectedBy: number | null, comment: string): Promise<ChangeRequest> {
        if (!comment) throw new Error('Rejection comment is mandatory.');

        const cr = await ChangeRequest.query().findById(changeRequestId);
        if (!cr) throw new Error('Change Request not found');
        if (cr.status !== 'open' && cr.status !== 'approved') {
            throw new Error('Only OPEN or APPROVED requests can be rejected');
        }

        // Get rejector info for notification (null means system rejection)
        const rejector = rejectedBy ? await User.query().findById(rejectedBy) : null;
        const rejectorName = rejector?.name || rejector?.email || 'System';

        // Update Status with rejection info
        await cr.$query().patch({
            status: 'rejected',
            rejectedBy: rejectedBy ?? undefined,  // Will be undefined for system rejections
            rejectedAt: knex.fn.now(),
            rejectionReason: comment
        });

        // Create Audit Log with comment
        await knex('g_audit_logs').insert({
            action: 'CHANGE_REQUEST_REJECTED',
            userId: rejectedBy || 0,  // 0 for system
            changeRequestId: cr.id,
            entityType: 'ChangeRequest',
            entityId: 0,
            newValues: JSON.stringify({ comment })
        });

        // Send SSE notification to requester
        await ChangeRequestNotifications.notifyRejected({
            id: cr.id,
            title: cr.title,
            environment: cr.environment,
            requesterId: cr.requesterId,
        }, rejectorName, comment, rejectedBy || 0);

        const updated = await cr.$query().findById(cr.id);
        if (!updated) throw new Error('Failed to retrieve updated change request');
        return updated;
    }

    static async reopenChangeRequest(changeRequestId: string, requesterId: number): Promise<ChangeRequest> {
        return await transaction(ChangeRequest.knex(), async (trx) => {
            const cr = await ChangeRequest.query(trx).findById(changeRequestId);
            if (!cr) throw new Error('Change Request not found');
            if (cr.status !== 'rejected') throw new Error('Only REJECTED requests can be reopened');

            const user = await User.query(trx).findById(requesterId);
            const isAdmin = user?.role === 'admin' || String(user?.role) === '0';

            // Validate ownership: Only the original requester or an admin can reopen
            if (cr.requesterId !== requesterId && !isAdmin) {
                throw new Error('Only the original requester or an admin can reopen this request.');
            }

            // Reset to Draft
            const updated = await cr.$query(trx).patchAndFetch({ status: 'draft' });

            // CRITICAL: Delete ALL approvals (Reset progress)
            await Approval.query(trx).where('changeRequestId', changeRequestId).delete();

            return updated;
        });
    }

    static async executeChangeRequest(changeRequestId: string, userId: number): Promise<ChangeRequest> {
        // Import service registry
        const { hasServiceHandler, getServiceHandler } = await import('./ServiceRegistry');

        const result = await transaction(ChangeRequest.knex(), async (trx) => {
            const cr = await ChangeRequest.query(trx)
                .findById(changeRequestId)
                .withGraphFetched('changeItems');

            if (!cr) throw new Error('Change Request not found');
            if (cr.status !== 'approved') throw new Error('Change Request must be APPROVED to execute');

            // Get environment settings for conflict check policy
            const env = await Environment.query(trx).findById(cr.environment);
            const strictConflictCheck = env?.strictConflictCheck ?? true; // Default to strict

            // Collect items for post-transaction service calls and Outbox events
            const serviceCallsNeeded: Array<{
                targetTable: string;
                targetId: string;
                afterData: any;
                beforeData: any;
                isCreate: boolean;
            }> = [];

            // Transactional Logic - verify data and prepare for service calls
            for (const item of (cr.changeItems || [])) {
                // 1. Validate table name
                if (!/^[a-zA-Z0-9_]+$/.test(item.targetTable)) {
                    throw new Error(`Invalid target table: ${item.targetTable}`);
                }

                const targetRow = await trx(item.targetTable)
                    .where('id', item.targetId)
                    .first()
                    .forUpdate(); // ROW LOCK

                // 2. Version-based Conflict Detection
                const liveData = targetRow || null;
                const isCreate = !liveData;

                // Check version if available (preferred method)
                const hasVersionColumn = liveData && typeof liveData.version === 'number';
                const storedEntityVersion = item.entityVersion;
                const liveVersion = liveData?.version;

                let hasConflict = false;
                let conflictReason = '';

                if (hasVersionColumn && storedEntityVersion !== undefined && storedEntityVersion !== null) {
                    // Version-based conflict detection
                    if (liveVersion !== storedEntityVersion) {
                        hasConflict = true;
                        conflictReason = `Version mismatch: expected ${storedEntityVersion}, found ${liveVersion}`;
                    }
                } else if (!isCreate) {
                    // Fallback to deep-diff comparison for tables without version column
                    const isMatch = compareData(liveData, item.beforeData);
                    if (!isMatch) {
                        hasConflict = true;
                        conflictReason = 'Data has changed since this request was created (deep-diff)';
                    }
                }

                if (hasConflict) {
                    if (strictConflictCheck) {
                        // Block execution on conflict
                        throw new GatrixError(
                            conflictReason,
                            409,
                            true,
                            'CR_DATA_CONFLICT',
                            {
                                originalDraftBase: item.beforeData,
                                currentLive: liveData,
                                userDraft: item.afterData,
                                storedVersion: storedEntityVersion,
                                liveVersion: liveVersion
                            }
                        );
                    } else {
                        // Warn but continue (dev/test environments)
                        logger.warn(`[ChangeRequest] Conflict detected but continuing (non-strict): ${conflictReason}`);
                    }
                }

                // 4. Apply Update - Check if service handler exists
                if (item.afterData) {
                    const isCreate = !liveData;

                    // Common non-column fields to strip for direct DB operations
                    const fieldsToStrip = [
                        'maintenanceLocales',
                        'tagIds',
                        'createdByName',
                        'createdByEmail',
                        'updatedByName',
                        'updatedByEmail',
                        'tags', // Often a list of tag objects from joins
                        'approvals', // Joined data
                        'environmentModel' // Joined data
                    ];

                    const dbData = { ...item.afterData };
                    fieldsToStrip.forEach(f => delete dbData[f]);

                    // Set ownership fields
                    if (isCreate && dbData.createdBy === undefined) {
                        dbData.createdBy = cr.requesterId;
                    }
                    dbData.updatedBy = userId;

                    // Convert ISO 8601 datetime strings to MySQL format
                    const dateFields = ['createdAt', 'updatedAt', 'startDate', 'endDate', 'saleStartAt', 'saleEndAt', 'maintenanceStartDate', 'maintenanceEndDate'];
                    for (const field of dateFields) {
                        if (dbData[field] && typeof dbData[field] === 'string') {
                            // Check if it's ISO 8601 format (ends with Z or has timezone offset)
                            if (dbData[field].includes('T') && (dbData[field].endsWith('Z') || dbData[field].match(/[+-]\d{2}:\d{2}$/))) {
                                const date = new Date(dbData[field]);
                                if (!isNaN(date.getTime())) {
                                    // Convert to MySQL DATETIME format: YYYY-MM-DD HH:MM:SS
                                    dbData[field] = date.toISOString().slice(0, 19).replace('T', ' ');
                                }
                            }
                        }
                    }

                    // Stringify JSON fields (objects/arrays) to ensure MySQL compatibility
                    for (const key in dbData) {
                        if (dbData[key] !== null && typeof dbData[key] === 'object' && !(dbData[key] instanceof Date)) {
                            dbData[key] = JSON.stringify(dbData[key]);
                        }
                    }

                    if (hasServiceHandler(item.targetTable)) {
                        let realId: string | number = item.targetId;

                        // Still update directly in transaction for atomicity
                        if (isCreate) {
                            // Check if table uses VARCHAR id (ULID) or INT auto_increment
                            const [columns] = await trx.raw(
                                `SHOW COLUMNS FROM ${item.targetTable} WHERE Field = 'id'`
                            );
                            const idColumnType = columns[0]?.Type?.toLowerCase() || '';
                            const usesStringId = idColumnType.includes('varchar') || idColumnType.includes('char');

                            if (usesStringId) {
                                // Generate a new ULID for VARCHAR id columns
                                const newId = ulid();
                                dbData.id = newId;
                                realId = newId;
                            } else {
                                // For INT auto_increment, don't set id - let DB handle it
                                delete dbData.id;
                            }

                            // Ensure environment is set for new records
                            if (!dbData.environment) {
                                dbData.environment = cr.environment;
                            }
                            // Ensure timestamps are set for new records
                            if (!dbData.createdAt) {
                                dbData.createdAt = new Date().toISOString().slice(0, 19).replace('T', ' ');
                            }
                            if (!dbData.updatedAt) {
                                dbData.updatedAt = new Date().toISOString().slice(0, 19).replace('T', ' ');
                            }
                            // Set initial version for new records
                            if (dbData.version === undefined) {
                                dbData.version = 1;
                            }
                            const [result] = await trx(item.targetTable).insert(dbData);
                            // For auto_increment, result is the new ID
                            if (!usesStringId && result) {
                                realId = result;
                            }
                        } else {
                            // Increment version on update
                            if (typeof liveData?.version === 'number') {
                                dbData.version = liveData.version + 1;
                            }
                            await trx(item.targetTable).where('id', item.targetId).update(dbData);
                        }

                        // Will call service after transaction commits
                        serviceCallsNeeded.push({
                            targetTable: item.targetTable,
                            targetId: String(realId),
                            afterData: item.afterData,
                            beforeData: liveData,
                            isCreate
                        });
                    } else {
                        // No service handler - direct update only, no events
                        if (isCreate) {
                            // Check if table uses VARCHAR id (ULID) or INT auto_increment
                            const [columns] = await trx.raw(
                                `SHOW COLUMNS FROM ${item.targetTable} WHERE Field = 'id'`
                            );
                            const idColumnType = columns[0]?.Type?.toLowerCase() || '';
                            const usesStringId = idColumnType.includes('varchar') || idColumnType.includes('char');

                            if (usesStringId) {
                                // Generate a new ULID for VARCHAR id columns
                                dbData.id = ulid();
                            } else {
                                // For INT auto_increment, don't set id - let DB handle it
                                delete dbData.id;
                            }

                            // Ensure environment is set for new records
                            if (!dbData.environment) {
                                dbData.environment = cr.environment;
                            }
                            // Ensure timestamps are set for new records
                            if (!dbData.createdAt) {
                                dbData.createdAt = new Date();
                            }
                            if (!dbData.updatedAt) {
                                dbData.updatedAt = new Date();
                            }
                            // Set initial version for new records
                            if (dbData.version === undefined) {
                                dbData.version = 1;
                            }
                            await trx(item.targetTable).insert(dbData);
                        } else {
                            // Increment version on update
                            if (typeof liveData?.version === 'number') {
                                dbData.version = liveData.version + 1;
                            }
                            await trx(item.targetTable).where('id', item.targetId).update(dbData);
                        }
                        logger.warn(`[ChangeRequest] No service handler for ${item.targetTable}, events not published`);
                    }
                }
            }

            // 5. Record Outbox events (within transaction for atomicity)
            if (serviceCallsNeeded.length > 0) {
                await OutboxService.recordCREvents(
                    cr.id,
                    serviceCallsNeeded.map(call => ({
                        entityType: call.targetTable,
                        entityId: call.targetId,
                        beforeData: call.beforeData,
                        afterData: call.afterData,
                        isCreate: call.isCreate,
                        isDelete: false // TODO: Handle deletes when supported
                    })),
                    trx
                );
            }

            // 6. Finalize
            const finalInfo = await cr.$query(trx).patchAndFetch({
                status: 'applied',
                executedBy: userId // Store who executed this request
            });

            // Fetch executor for notification
            const executor = await User.query(trx).findById(userId);

            // Notify frontend
            await ChangeRequestNotifications.notifyExecuted({
                id: cr.id,
                title: cr.title,
                environment: cr.environment,
                requesterId: cr.requesterId
            }, executor?.name || executor?.email, userId);

            // Log Execution
            await knex('g_audit_logs').transacting(trx).insert({
                action: 'CHANGE_REQUEST_EXECUTED',
                userId,
                changeRequestId: cr.id,
                entityType: 'ChangeRequest',
                entityId: 0
            });

            return { cr: finalInfo, serviceCallsNeeded };
        });

        // 6. After transaction commits, publish events via service layer
        if (result.serviceCallsNeeded.length > 0) {
            for (const call of result.serviceCallsNeeded) {
                const handler = getServiceHandler(call.targetTable);
                if (handler) {
                    try {
                        // Handler is an object implementing ServiceHandler, not a class
                        await handler.apply(
                            call.targetId,
                            call.afterData,
                            result.cr.environment, // Use environment from result CR
                            userId // Pass executor ID to service for audit/context
                        );
                    } catch (err) {
                        logger.error(`[ChangeRequest] Post-execution service hook failed for ${call.targetTable}:${call.targetId}`, err);
                        // We do NOT rollback transaction here as data is already committed.
                        // Just log error. Ideally this should be robust or queue-based.
                    }
                }
            }
        }

        return result.cr;
    }

    static async rollbackChangeRequest(changeRequestId: string, userId: number): Promise<ChangeRequest> {
        return await transaction(ChangeRequest.knex(), async (trx) => {
            const originalCr = await ChangeRequest.query(trx)
                .findById(changeRequestId)
                .withGraphFetched('changeItems');

            if (!originalCr) throw new GatrixError('Change Request not found', 404);
            if (originalCr.status !== 'applied') throw new GatrixError('Only APPLIED requests can be rolled back', 400);

            // Create new CR for rollback
            const newCrKey = ulid();
            const newCr = await ChangeRequest.query(trx).insert({
                id: newCrKey,
                title: `Rollback: ${originalCr.title}`,
                description: `Rollback of request #${originalCr.id}`,
                requesterId: userId,
                environment: originalCr.environment,
                status: 'open',
                type: 'rollback',
                priority: originalCr.priority || 'medium',
                category: originalCr.category || 'general'
            });

            // Process items - Reversing the operations
            for (const item of (originalCr.changeItems || [])) {
                // Determine action type for rollback
                let actionType: ActionGroupType = ACTION_GROUP_TYPES.UPDATE_ENTITY;
                if (!item.beforeData) {
                    // Original was CREATE (before was null), so rollback is DELETE
                    actionType = ACTION_GROUP_TYPES.DELETE_ENTITY;
                } else if (!item.afterData) {
                    // Original was DELETE (after was null), so rollback is CREATE
                    actionType = ACTION_GROUP_TYPES.CREATE_ENTITY;
                }

                // Find or create ActionGroup for the new CR to maintain UI consistency
                let actionGroup = await ActionGroup.query(trx)
                    .where('changeRequestId', newCrKey)
                    .where('actionType', actionType)
                    .where('title', 'like', `%${item.targetTable.startsWith('g_') ? item.targetTable.slice(2) : item.targetTable}%`)
                    .first();

                if (!actionGroup) {
                    const cleanTable = item.targetTable.startsWith('g_') ? item.targetTable.slice(2) : item.targetTable;
                    const actionLabel = actionType === ACTION_GROUP_TYPES.CREATE_ENTITY ? 'Restore' :
                        actionType === ACTION_GROUP_TYPES.DELETE_ENTITY ? 'Remove' : 'Revert';

                    const maxOrder = await ActionGroup.query(trx)
                        .where('changeRequestId', newCrKey)
                        .max('orderIndex as maxOrder')
                        .first() as any;
                    const nextOrder = (maxOrder?.maxOrder ?? -1) + 1;

                    actionGroup = await ActionGroup.query(trx).insert({
                        id: ulid(),
                        changeRequestId: newCrKey,
                        actionType,
                        title: `${actionLabel} ${cleanTable}`,
                        orderIndex: nextOrder
                    });
                }

                // Fetch current live data to use as "beforeData" for the rollback item
                let currentLive = null;
                const tableExists = await trx.schema.hasTable(item.targetTable);
                if (tableExists) {
                    currentLive = await trx(item.targetTable).where('id', item.targetId).first();
                }

                // Desired state for rollback is the "beforeData" of the original change
                await ChangeItem.query(trx).insert({
                    id: ulid(),
                    changeRequestId: newCrKey,
                    actionGroupId: actionGroup.id,
                    targetTable: item.targetTable,
                    targetId: item.targetId,
                    beforeData: currentLive ?? null,  // Current state
                    afterData: item.beforeData ?? null   // Original baseline (restoring this)
                });
            }

            // Notify
            const requester = await User.query(trx).findById(userId);
            try {
                // Treating rollback creation as a new submission for notification purposes
                await ChangeRequestNotifications.notifySubmitted({
                    id: newCr.id,
                    title: newCr.title,
                    environment: newCr.environment,
                    requesterId: userId,
                    requesterName: requester?.name || requester?.email
                });
            } catch (err) {
                logger.error('[ChangeRequest] Failed to send rollback notification', err);
            }

            // Return the full CR with items AND action groups
            const result = await ChangeRequest.query(trx)
                .findById(newCr.id)
                .withGraphFetched('[changeItems, actionGroups.changeItems]');

            if (!result) {
                throw new Error('Failed to create rollback request');
            }

            return result;
        });
    }

    /**
     * Delete rejected change requests older than X days
     */
    static async cleanupRejected(retentionDays: number): Promise<number> {
        const thresholdDate = new Date();
        thresholdDate.setDate(thresholdDate.getDate() - retentionDays);
        const isoThreshold = thresholdDate.toISOString().slice(0, 19).replace('T', ' ');

        return await transaction(ChangeRequest.knex(), async (trx) => {
            // Find IDs to delete first to handle related data
            const oldRequests = await ChangeRequest.query(trx)
                .where('status', 'rejected')
                .where('rejectedAt', '<', isoThreshold)
                .select('id');

            const ids = oldRequests.map(r => r.id);
            if (ids.length === 0) return 0;

            // Delete related items and approvals
            await ChangeItem.query(trx).whereIn('changeRequestId', ids).delete();
            await Approval.query(trx).whereIn('changeRequestId', ids).delete();

            // Delete requests
            const deleted = await ChangeRequest.query(trx).whereIn('id', ids).delete();

            logger.info('[ChangeRequest] Cleanup completed', { deleted, retentionDays });
            return deleted;
        });
    }

    /**
     * Get counts of change requests by status
     * @param environment Environment name
     * @param userId User ID (for draft visibility)
     */
    static async getChangeRequestCounts(environment: string, userId: number): Promise<Record<string, number>> {
        const counts = await ChangeRequest.query()
            .where('environment', environment)
            .where((builder) => {
                builder.whereNot('status', 'draft')
                    .orWhere((subBuilder) => {
                        subBuilder.where('status', 'draft').where('requesterId', userId);
                    });
            })
            .groupBy('status')
            .select('status')
            .count('* as count');

        const result: Record<string, number> = {
            all: 0,
            draft: 0,
            open: 0,
            approved: 0,
            applied: 0,
            rejected: 0,
        };

        let total = 0;
        counts.forEach((row: any) => {
            const count = parseInt(row.count as string);
            result[row.status] = count;
            total += count;
        });
        result.all = total;

        return result;
    }
}

// Helper for deep comparison handling generic JSON/DB response differences
function compareData(live: unknown, snapshot: unknown): boolean {
    // If both null/undefined/empty
    if (!live && !snapshot) return true;

    // Normalize objects to handle field order differences
    // This is necessary because DB JSON fields may be returned with different key orders
    const normalizedLive = normalizeForComparison(live);
    const normalizedSnapshot = normalizeForComparison(snapshot);

    // Utilize deep-diff
    const differences = diff(normalizedLive, normalizedSnapshot);
    // If diff is undefined, they are equal
    return !differences;
}

// Recursively sort object keys to ensure consistent comparison regardless of field order
function normalizeForComparison(value: unknown): unknown {
    if (value === null || value === undefined) {
        return value;
    }

    // Handle Date objects - convert to ISO string for consistent comparison
    if (value instanceof Date) {
        return value.toISOString();
    }

    if (Array.isArray(value)) {
        return value.map(item => normalizeForComparison(item));
    }

    if (typeof value === 'object') {
        const obj = value as Record<string, unknown>;
        const sortedKeys = Object.keys(obj).sort();
        const result: Record<string, unknown> = {};
        for (const key of sortedKeys) {
            result[key] = normalizeForComparison(obj[key]);
        }
        return result;
    }

    return value;
}
