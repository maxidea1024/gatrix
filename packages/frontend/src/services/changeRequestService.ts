import api from './api';

// Types
export type ChangeRequestStatus = 'draft' | 'open' | 'approved' | 'applied' | 'rejected' | 'conflict';
export type ChangeRequestPriority = 'low' | 'medium' | 'high' | 'critical';

export interface ChangeItem {
    id: string;
    changeRequestId: string;
    actionGroupId?: string;
    targetTable: string;
    targetId: string;
    operation: 'create' | 'update' | 'delete';
    beforeData: any;
    afterData: any;
    entityVersion?: number;
}

export type ActionGroupType = 'CREATE_ENTITY' | 'UPDATE_ENTITY' | 'DELETE_ENTITY' | 'TOGGLE_FLAG' | 'UPDATE_RULE' | 'BATCH_UPDATE' | 'REVERT';

export interface ActionGroup {
    id: string;
    changeRequestId: string;
    actionType: ActionGroupType;
    title: string;
    description?: string;
    orderIndex: number;
    createdAt: string;
    changeItems?: ChangeItem[];
}

export interface Approval {
    id: string;
    changeRequestId: string;
    approverId: number;
    comment?: string;
    createdAt: string;
    approver?: {
        id: number;
        name: string;
        email: string;
    };
}

export interface ChangeRequest {
    id: string;
    requesterId: number;
    environment: string;
    status: ChangeRequestStatus;
    title: string;
    description?: string;
    reason?: string;
    impactAnalysis?: string;
    priority: ChangeRequestPriority;
    category: string;
    rejectedBy?: number;
    rejectedAt?: string;
    rejectionReason?: string;
    createdAt: string;
    updatedAt: string;
    requester?: {
        id: number;
        name: string;
        email: string;
    };
    rejector?: {
        id: number;
        name: string;
        email: string;
    };
    environmentModel?: {
        environment: string;
        displayName: string;
        requiredApprovers: number;
    };
    changeItems?: ChangeItem[];
    actionGroups?: ActionGroup[];
    approvals?: Approval[];
    executedBy?: number;
    executor?: {
        id: number;
        name: string;
        email: string;
    };
}

export interface ChangeRequestListResponse {
    items: ChangeRequest[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

export interface MyRequestsResponse {
    myRequests: ChangeRequest[];
    myDrafts: ChangeRequest[];
    pendingApproval: ChangeRequest[];
}

class ChangeRequestService {
    /**
     * Get list of change requests
     */
    async list(params?: {
        status?: ChangeRequestStatus;
        page?: number;
        limit?: number;
    }): Promise<ChangeRequestListResponse> {
        const response = await api.get('/admin/change-requests', { params });
        return response.data;
    }

    /**
     * Get single change request by ID
     */
    async getById(id: string): Promise<ChangeRequest> {
        const response = await api.get(`/admin/change-requests/${id}`);
        return response.data;
    }

    /**
     * Update change request metadata (Draft only)
     */
    async updateMetadata(
        id: string,
        metadata: {
            title?: string;
            description?: string;
            reason?: string;
            impactAnalysis?: string;
            priority?: ChangeRequestPriority;
            category?: string;
        }
    ): Promise<ChangeRequest> {
        const response = await api.patch(`/admin/change-requests/${id}`, metadata);
        return response.data;
    }

    /**
     * Submit change request for review (Draft -> Open)
     */
    async submit(id: string, data: { title: string; reason: string }): Promise<ChangeRequest> {
        const response = await api.post(`/admin/change-requests/${id}/submit`, data);
        return response.data;
    }

    /**
     * Approve change request
     */
    async approve(id: string, comment?: string): Promise<ChangeRequest> {
        const response = await api.post(`/admin/change-requests/${id}/approve`, { comment });
        return response.data;
    }

    /**
     * Reject change request
     */
    async reject(id: string, comment: string): Promise<ChangeRequest> {
        const response = await api.post(`/admin/change-requests/${id}/reject`, { comment });
        return response.data;
    }

    /**
     * Reopen rejected change request (Reset to Draft)
     */
    async reopen(id: string): Promise<ChangeRequest> {
        const response = await api.post(`/admin/change-requests/${id}/reopen`);
        return response.data;
    }

    /**
     * Execute approved change request
     */
    async execute(id: string): Promise<ChangeRequest> {
        const response = await api.post(`/admin/change-requests/${id}/execute`);
        return response.data;
    }

    /**
     * Delete draft change request
     */
    async delete(id: string): Promise<void> {
        await api.delete(`/admin/change-requests/${id}`);
    }

    /**
     * Get my pending requests (as requester or approver)
     */
    async getMyRequests(): Promise<MyRequestsResponse> {
        const response = await api.get('/admin/change-requests/my');
        return response.data;
    }

    /**
     * Get rollback preview (inverse ops without creating CR)
     */
    async getRollbackPreview(id: string): Promise<any> {
        const response = await api.get(`/admin/change-requests/${id}/rollback-preview`);
        return response.data;
    }

    /**
     * Rollback applied change request
     */
    async rollback(id: string): Promise<ChangeRequest> {
        const response = await api.post(`/admin/change-requests/${id}/rollback`);
        return response.data;
    }

    /**
     * Delete a specific change item from a change request
     */
    async deleteChangeItem(changeRequestId: string, itemId: string): Promise<void> {
        await api.delete(`/admin/change-requests/${changeRequestId}/items/${itemId}`);
    }

    /**
     * Get change request statistics
     */
    async getStats(): Promise<Record<string, number>> {
        const response = await api.get('/admin/change-requests/stats');
        return response.data;
    }
}

export default new ChangeRequestService();
