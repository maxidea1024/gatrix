/**
 * Argus Feedback, Spam, and Feedback-Issue Linking API.
 */
import { argusApi, ARGUS_BASE } from './argusApi';
import type {
  ArgusFeedbackItem,
  ArgusFeedbackResponse,
  ArgusFeedbackActivity,
} from './argusTypes';

// --- Feedback ---

export async function getFeedback(
  projectId: number | string,
  params?: {
    period?: string;
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    start?: string;
    end?: string;
    sort?: string;
    filterUrl?: string;
    filterAssigned?: string;
    filterEnvironment?: string;
    filterBrowser?: string;
    filterOs?: string;
  }
): Promise<ArgusFeedbackResponse> {
  const response = await argusApi.get(`${ARGUS_BASE}/feedback/${projectId}`, {
    params,
  });
  return response.data?.data || response.data;
}

export async function getFeedbackDetail(
  projectId: number | string,
  feedbackId: string,
  signal?: AbortSignal
): Promise<ArgusFeedbackItem | null> {
  try {
    const response = await argusApi.get(
      `${ARGUS_BASE}/feedback/${projectId}/detail/${feedbackId}`,
      { signal }
    );
    return response.data?.data || response.data || null;
  } catch {
    return null;
  }
}

export async function getFeedbackFilterOptions(
  projectId: number | string,
  period?: string
): Promise<{
  environments: string[];
  browsers: string[];
  os: string[];
  assigned: string[];
}> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/feedback/${projectId}/filter-options`,
    {
      params: { period },
    }
  );
  return (
    response.data?.data ||
    response.data || { environments: [], browsers: [], os: [], assigned: [] }
  );
}

/**
 * Generic attribute facet for feedback — returns top values for any column.
 * Same pattern as getAttributeFacet (logs), but queries the user_feedback table.
 */
export async function getFeedbackAttributeFacet(
  projectId: number | string,
  key: string,
  params?: { period?: string; start?: string; end?: string }
): Promise<{ attr_value: string; count: number }[]> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/feedback/${projectId}/attribute-facet`,
    {
      params: { key, ...params },
    }
  );
  return response.data?.data || [];
}

export async function markFeedbackRead(
  projectId: number | string,
  feedbackIds: string[]
): Promise<void> {
  await argusApi.post(`${ARGUS_BASE}/feedback/${projectId}/mark-read`, {
    feedback_ids: feedbackIds,
  });
}

export async function getFeedbackActivity(
  projectId: number | string,
  feedbackId: string,
  limit?: number,
  offset?: number
): Promise<ArgusFeedbackActivity[]> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/feedback/${projectId}/${feedbackId}/activity`,
    {
      params: { limit, offset },
    }
  );
  return response.data?.data || response.data || [];
}

export async function addFeedbackComment(
  projectId: number | string,
  feedbackId: string,
  text: string,
  userName?: string
): Promise<{ id: number }> {
  const response = await argusApi.post(
    `${ARGUS_BASE}/feedback/${projectId}/${feedbackId}/comment`,
    {
      text,
      user_name: userName,
    }
  );
  return response.data?.data || response.data;
}

export async function updateFeedback(
  projectId: number | string,
  feedbackId: string,
  data: { status?: string; assigned_to?: string; is_spam?: boolean }
): Promise<void> {
  await argusApi.patch(
    `${ARGUS_BASE}/feedback/${projectId}/${feedbackId}`,
    data
  );
}

export async function bulkFeedbackAction(
  projectId: number | string,
  feedbackIds: string[],
  action: 'resolve' | 'unresolve' | 'spam' | 'not_spam' | 'assign',
  assignedTo?: string
): Promise<void> {
  await argusApi.post(`${ARGUS_BASE}/feedback/${projectId}/bulk`, {
    feedback_ids: feedbackIds,
    action,
    assigned_to: assignedTo,
  });
}

export async function uploadFeedbackAttachments(
  projectId: number | string,
  feedbackId: string,
  files: File[]
): Promise<{ urls: string[] }> {
  const formData = new FormData();
  files.forEach((f) => formData.append('files', f));
  const response = await argusApi.post(
    `${ARGUS_BASE}/feedback/${projectId}/${feedbackId}/attachments`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  );
  return response.data?.data || response.data;
}

// --- Feedback-Issue Linking ---

export async function linkFeedbackToIssue(
  projectId: number | string,
  feedbackId: string,
  issueId: number
): Promise<void> {
  await argusApi.patch(
    `${ARGUS_BASE}/feedback/${projectId}/${feedbackId}/link-issue`,
    {
      issue_id: issueId,
    }
  );
}

export async function unlinkFeedbackFromIssue(
  projectId: number | string,
  feedbackId: string
): Promise<void> {
  await argusApi.patch(
    `${ARGUS_BASE}/feedback/${projectId}/${feedbackId}/link-issue`,
    {
      issue_id: null,
    }
  );
}

export async function getFeedbacksByIssue(
  projectId: number | string,
  issueId: number | string
): Promise<any[]> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/feedback/${projectId}/by-issue/${issueId}`
  );
  return response.data?.data || response.data || [];
}

// --- Issue Creation (from feedback) ---

export async function createIssue(
  projectId: number | string,
  data: {
    title: string;
    level?: string;
    message?: string;
    culprit?: string;
    tracker_id?: number;
  }
): Promise<{ id: number; external_url?: string; external_key?: string }> {
  const response = await argusApi.post(
    `${ARGUS_BASE}/${projectId}/issues`,
    data
  );
  return response.data?.data || response.data;
}

/** Pre-save connection test for notification channels */
export async function testNotificationChannelPreSave(
  projectId: number | string,
  data: { provider: string; config: Record<string, any> }
): Promise<{ ok: boolean; message: string }> {
  const response = await argusApi.post(
    `${ARGUS_BASE}/${projectId}/notification-channels/test-connection`,
    data
  );
  return response.data?.data || response.data;
}

// --- Spam Filter Keywords ---

export async function getSpamKeywords(
  projectId: number | string
): Promise<
  { id: number; keyword: string; is_regex: boolean; created_at: string }[]
> {
  const response = await argusApi.get(
    `${ARGUS_BASE}/feedback/${projectId}/spam-keywords`
  );
  return response.data?.data || response.data || [];
}

export async function addSpamKeyword(
  projectId: number | string,
  keyword: string,
  isRegex: boolean = false
): Promise<{ id: number }> {
  const response = await argusApi.post(
    `${ARGUS_BASE}/feedback/${projectId}/spam-keywords`,
    {
      keyword,
      is_regex: isRegex,
    }
  );
  return response.data?.data || response.data;
}

export async function deleteSpamKeyword(
  projectId: number | string,
  keywordId: number
): Promise<void> {
  await argusApi.delete(
    `${ARGUS_BASE}/feedback/${projectId}/spam-keywords/${keywordId}`
  );
}

export async function runAutoSpam(
  projectId: number | string
): Promise<{ matched: number }> {
  const response = await argusApi.post(
    `${ARGUS_BASE}/feedback/${projectId}/auto-spam`
  );
  return response.data?.data || response.data;
}
