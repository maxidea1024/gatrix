/**
 * Generic Draft Service
 *
 * Frontend client for the generic draft API.
 * Provides methods to manage drafts for any content type.
 */

import api from './api';

// ==================== Types ====================

export interface DraftRecord {
  id: string;
  targetType: string;
  targetId: string;
  environmentId?: string | null;
  draftData: any;
  createdBy: string;
  updatedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DraftSnapshotResponse {
  draftData: any;
  hasDraft: boolean;
  publishedData?: any;
}

// ==================== Service ====================

function basePath(projectApiPath: string | null): string {
  return projectApiPath ? `${projectApiPath}/drafts` : '/admin/drafts';
}

/**
 * Get draft or published snapshot for a target
 */
export async function getDraft(
  targetType: string,
  targetId: string,
  projectApiPath: string | null = null
): Promise<DraftSnapshotResponse> {
  const response = await api.get(
    `${basePath(projectApiPath)}/${targetType}/${targetId}`
  );
  return response.data;
}

/**
 * Save draft data
 */
export async function saveDraft(
  targetType: string,
  targetId: string,
  draftData: any,
  projectApiPath: string | null = null
): Promise<DraftRecord> {
  const response = await api.put(
    `${basePath(projectApiPath)}/${targetType}/${targetId}`,
    draftData
  );
  return response.data.draft;
}

/**
 * Publish draft
 */
export async function publishDraft(
  targetType: string,
  targetId: string,
  projectApiPath: string | null = null
): Promise<any> {
  const response = await api.post(
    `${basePath(projectApiPath)}/${targetType}/${targetId}/publish`
  );
  return response.data;
}

/**
 * Discard draft
 */
export async function discardDraft(
  targetType: string,
  targetId: string,
  projectApiPath: string | null = null
): Promise<void> {
  await api.post(
    `${basePath(projectApiPath)}/${targetType}/${targetId}/discard`
  );
}

/**
 * List drafts for a target type
 */
export async function listDrafts(
  targetType: string,
  projectApiPath: string | null = null
): Promise<DraftRecord[]> {
  const response = await api.get(`${basePath(projectApiPath)}/${targetType}`);
  return response.data.drafts;
}

/**
 * Check if a draft exists
 */
export async function hasDraft(
  targetType: string,
  targetId: string,
  projectApiPath: string | null = null
): Promise<boolean> {
  const result = await getDraft(targetType, targetId, projectApiPath);
  return result.hasDraft;
}

const draftService = {
  getDraft,
  saveDraft,
  publishDraft,
  discardDraft,
  listDrafts,
  hasDraft,
};

export default draftService;
