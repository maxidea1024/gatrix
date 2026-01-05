import api from './api';

// Types
export type ChangeRequestStatus = 'draft' | 'open' | 'approved' | 'applied' | 'rejected';
export type ChangeRequestPriority = 'low' | 'medium' | 'high' | 'critical';

export interface ChangeItem {
    id: string;
    changeRequestId: string;
    targetTable: string;
    targetId: string;
    operation: 'create' | 'update' | 'delete';
    beforeData: any;
    afterData: any;
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
     * Rollback applied change request
     */
    async rollback(id: string): Promise<ChangeRequest> {
        const response = await api.post(`/admin/change-requests/${id}/rollback`);
        return response.data;
    }
}

export default new ChangeRequestService();
