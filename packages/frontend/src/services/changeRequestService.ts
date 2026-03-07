import api from './api';

// Types
export type ChangeRequestStatus =
  | 'draft'
  | 'open'
  | 'approved'
  | 'applied'
  | 'rejected'
  | 'conflict';
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

export type ActionGroupType =
  | 'CREATE_ENTITY'
  | 'UPDATE_ENTITY'
  | 'DELETE_ENTITY'
  | 'TOGGLE_FLAG'
  | 'UPDATE_RULE'
  | 'BATCH_UPDATE'
  | 'REVERT';

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
  environmentId: string;
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
    environmentId: string;
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

/** Build change-requests base path from project-scoped path or fallback */
function basePath(projectApiPath: string | null): string {
  return projectApiPath ? `${projectApiPath}/change-requests` : '/admin/change-requests';
}

class ChangeRequestService {
  /**
   * Get list of change requests
   */
  async list(
    params?: {
      status?: ChangeRequestStatus;
      page?: number;
      limit?: number;
    },
    projectApiPath: string | null = null
  ): Promise<ChangeRequestListResponse> {
    const response = await api.get(basePath(projectApiPath), { params });
    return response.data;
  }

  /**
   * Get single change request by ID
   */
  async getById(id: string, projectApiPath: string | null = null): Promise<ChangeRequest> {
    const response = await api.get(`${basePath(projectApiPath)}/${id}`);
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
    },
    projectApiPath: string | null = null
  ): Promise<ChangeRequest> {
    const response = await api.patch(`${basePath(projectApiPath)}/${id}`, metadata);
    return response.data;
  }

  /**
   * Submit change request for review (Draft -> Open)
   */
  async submit(
    id: string,
    data: { title: string; reason: string },
    projectApiPath: string | null = null
  ): Promise<ChangeRequest> {
    const response = await api.post(`${basePath(projectApiPath)}/${id}/submit`, data);
    return response.data;
  }

  /**
   * Approve change request
   */
  async approve(
    id: string,
    comment?: string,
    projectApiPath: string | null = null
  ): Promise<ChangeRequest> {
    const response = await api.post(`${basePath(projectApiPath)}/${id}/approve`, {
      comment,
    });
    return response.data;
  }

  /**
   * Reject change request
   */
  async reject(
    id: string,
    comment: string,
    projectApiPath: string | null = null
  ): Promise<ChangeRequest> {
    const response = await api.post(`${basePath(projectApiPath)}/${id}/reject`, {
      comment,
    });
    return response.data;
  }

  /**
   * Reopen rejected change request (Reset to Draft)
   */
  async reopen(id: string, projectApiPath: string | null = null): Promise<ChangeRequest> {
    const response = await api.post(`${basePath(projectApiPath)}/${id}/reopen`);
    return response.data;
  }

  /**
   * Execute approved change request
   */
  async execute(id: string, projectApiPath: string | null = null): Promise<ChangeRequest> {
    const response = await api.post(`${basePath(projectApiPath)}/${id}/execute`);
    return response.data;
  }

  /**
   * Delete draft change request
   */
  async delete(id: string, projectApiPath: string | null = null): Promise<void> {
    await api.delete(`${basePath(projectApiPath)}/${id}`);
  }

  /**
   * Get my pending requests (as requester or approver)
   */
  async getMyRequests(projectApiPath: string | null = null): Promise<MyRequestsResponse> {
    const response = await api.get(`${basePath(projectApiPath)}/my`);
    return response.data;
  }

  /**
   * Get revert preview (inverse ops without creating CR)
   */
  async getRevertPreview(id: string, projectApiPath: string | null = null): Promise<any> {
    const response = await api.get(`${basePath(projectApiPath)}/${id}/revert-preview`);
    return response.data;
  }

  /**
   * Revert applied change request
   */
  async revert(id: string, projectApiPath: string | null = null): Promise<ChangeRequest> {
    const response = await api.post(`${basePath(projectApiPath)}/${id}/revert`);
    return response.data;
  }

  /**
   * Delete a specific change item from a change request
   */
  async deleteChangeItem(
    changeRequestId: string,
    itemId: string,
    projectApiPath: string | null = null
  ): Promise<void> {
    await api.delete(`${basePath(projectApiPath)}/${changeRequestId}/items/${itemId}`);
  }

  /**
   * Get change request statistics
   */
  async getStats(projectApiPath: string | null = null): Promise<Record<string, number>> {
    const response = await api.get(`${basePath(projectApiPath)}/stats`);
    return response.data;
  }
}

export default new ChangeRequestService();
