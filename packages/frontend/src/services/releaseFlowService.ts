import api from './api';

// ==================== Types ====================

export type FlowStatus = 'draft' | 'active' | 'paused' | 'completed';

export interface TransitionCondition {
  intervalMinutes: number;
}
export interface ReleaseFlowStrategy {
  id: string;
  milestoneId: string;
  strategyName: string;
  parameters: any;
  constraints?: any[];
  sortOrder: number;
  segments?: string[];
}

export interface ReleaseFlowMilestone {
  id: string;
  flowId: string;
  name: string;
  description?: string;
  sortOrder: number;
  strategies?: ReleaseFlowStrategy[];
  startedAt?: string;
  transitionCondition?: TransitionCondition | null;
  progressionExecutedAt?: string | null;
  pausedAt?: string | null;
}

export interface ReleaseFlowTemplate {
  id: string;
  flowName: string;
  displayName?: string;
  description?: string;
  milestones?: ReleaseFlowMilestone[];
  createdBy?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReleaseFlowPlan {
  id: string;
  flowName: string;
  displayName?: string;
  description?: string;
  flagId: string;
  environmentId: string;
  templateId?: string;
  activeMilestoneId?: string;
  status: FlowStatus;
  createdAt: string;
  updatedAt: string;
  milestones?: ReleaseFlowMilestone[];
}

export interface CreateTemplateInput {
  flowName: string;
  displayName?: string;
  description?: string;
  milestones: {
    name: string;
    sortOrder: number;
    transitionCondition?: TransitionCondition | null;
    strategies: {
      strategyName: string;
      parameters: any;
      constraints?: any[];
      sortOrder: number;
      segments?: string[];
    }[];
  }[];
}

export interface ApplyTemplateInput {
  flagId: string;
  environmentId: string;
  templateId: string;
}

// ==================== Service ====================

/** Build release-flows base path from project-scoped path or fallback */
function basePath(projectApiPath: string | null): string {
  return projectApiPath
    ? `${projectApiPath}/release-flows`
    : '/admin/release-flows';
}

/**
 * List all templates
 */
export async function getTemplates(
  search?: string,
  projectApiPath: string | null = null
): Promise<ReleaseFlowTemplate[]> {
  const response = await api.get(`${basePath(projectApiPath)}/templates`, {
    params: { search },
  });
  return response.data || [];
}

/**
 * Create a new template
 */
export async function createTemplate(
  data: CreateTemplateInput,
  projectApiPath: string | null = null
): Promise<ReleaseFlowTemplate> {
  const response = await api.post(
    `${basePath(projectApiPath)}/templates`,
    data
  );
  return response.data;
}

/**
 * Apply a template to a feature flag and environment
 */
export async function applyTemplate(
  data: ApplyTemplateInput,
  projectApiPath: string | null = null
): Promise<ReleaseFlowPlan> {
  const response = await api.post(`${basePath(projectApiPath)}/apply`, data);
  return response.data;
}

/**
 * Get the active release plan for a flag and environment
 */
export async function getPlan(
  flagId: string,
  environmentId: string,
  projectApiPath: string | null = null
): Promise<ReleaseFlowPlan | null> {
  const response = await api.get(
    `${basePath(projectApiPath)}/plans/${flagId}/${environmentId}`
  );
  return response.data;
}

/**
 * Start a milestone in a release plan
 */
export async function startMilestone(
  planId: string,
  milestoneId: string,
  projectApiPath: string | null = null
): Promise<void> {
  await api.post(
    `${basePath(projectApiPath)}/plans/${planId}/milestones/${milestoneId}/start`
  );
}

/**
 * Get a single template by ID (with milestones and strategies)
 */
export async function getTemplate(
  id: string,
  projectApiPath: string | null = null
): Promise<ReleaseFlowTemplate> {
  const response = await api.get(`${basePath(projectApiPath)}/templates/${id}`);
  return response.data;
}

/**
 * Update an existing template
 */
export async function updateTemplate(
  id: string,
  data: Partial<CreateTemplateInput>,
  projectApiPath: string | null = null
): Promise<ReleaseFlowTemplate> {
  const response = await api.put(
    `${basePath(projectApiPath)}/templates/${id}`,
    data
  );
  return response.data;
}

/**
 * Delete (archive) a template
 */
export async function deleteTemplate(
  id: string,
  projectApiPath: string | null = null
): Promise<void> {
  await api.delete(`${basePath(projectApiPath)}/templates/${id}`);
}

/**
 * Delete (archive) an applied plan
 */
export async function deletePlan(
  planId: string,
  projectApiPath: string | null = null
): Promise<void> {
  await api.delete(`${basePath(projectApiPath)}/plans/${planId}`);
}

// ==================== Plan Lifecycle ====================

/**
 * Start a release plan (begins from first milestone)
 */
export async function startPlan(
  planId: string,
  projectApiPath: string | null = null
): Promise<ReleaseFlowPlan> {
  const response = await api.post(
    `${basePath(projectApiPath)}/plans/${planId}/start`
  );
  return response.data;
}

/**
 * Pause a running release plan
 */
export async function pausePlan(
  planId: string,
  projectApiPath: string | null = null
): Promise<ReleaseFlowPlan> {
  const response = await api.post(
    `${basePath(projectApiPath)}/plans/${planId}/pause`
  );
  return response.data;
}

/**
 * Resume a paused release plan
 */
export async function resumePlan(
  planId: string,
  projectApiPath: string | null = null
): Promise<ReleaseFlowPlan> {
  const response = await api.post(
    `${basePath(projectApiPath)}/plans/${planId}/resume`
  );
  return response.data;
}

/**
 * Progress to the next milestone manually
 */
export async function progressToNext(
  planId: string,
  projectApiPath: string | null = null
): Promise<ReleaseFlowPlan> {
  const response = await api.post(
    `${basePath(projectApiPath)}/plans/${planId}/progress`
  );
  return response.data;
}

/**
 * Set transition condition on a milestone
 */
export async function setTransitionCondition(
  milestoneId: string,
  intervalMinutes: number,
  projectApiPath: string | null = null
): Promise<ReleaseFlowMilestone> {
  const response = await api.put(
    `${basePath(projectApiPath)}/milestones/${milestoneId}/transition`,
    { intervalMinutes }
  );
  return response.data;
}

/**
 * Remove transition condition from a milestone
 */
export async function removeTransitionCondition(
  milestoneId: string,
  projectApiPath: string | null = null
): Promise<ReleaseFlowMilestone> {
  const response = await api.delete(
    `${basePath(projectApiPath)}/milestones/${milestoneId}/transition`
  );
  return response.data;
}

// ==================== Safeguards ====================

export interface Safeguard {
  id: string;
  flowId: string;
  milestoneId: string;
  metricName: string;
  displayName: string | null;
  aggregationMode: string;
  operator: string;
  threshold: number;
  timeRangeMinutes: number;
  labelFilters: Record<string, string> | null;
  action: string;
  isTriggered: boolean;
  triggeredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSafeguardInput {
  flowId: string;
  milestoneId: string;
  metricName: string;
  displayName?: string;
  aggregationMode?: string;
  operator?: string;
  threshold: number;
  timeRangeMinutes?: number;
  labelFilters?: Record<string, string>;
  action?: string;
}

export interface UpdateSafeguardInput {
  metricName?: string;
  displayName?: string | null;
  aggregationMode?: string;
  operator?: string;
  threshold?: number;
  timeRangeMinutes?: number;
  labelFilters?: Record<string, string> | null;
  action?: string;
}

export interface SafeguardEvaluationResult {
  safeguardId: string;
  metricName: string;
  currentValue: number | null;
  threshold: number;
  operator: string;
  triggered: boolean;
  error?: string;
}

/**
 * List safeguards for a milestone
 */
export async function listSafeguards(
  milestoneId: string,
  projectApiPath: string | null = null
): Promise<Safeguard[]> {
  const response = await api.get(
    `${basePath(projectApiPath)}/milestones/${milestoneId}/safeguards`
  );
  return response.data || [];
}

/**
 * Create a safeguard
 */
export async function createSafeguard(
  data: CreateSafeguardInput,
  projectApiPath: string | null = null
): Promise<Safeguard> {
  const response = await api.post(
    `${basePath(projectApiPath)}/safeguards`,
    data
  );
  return response.data;
}

/**
 * Update a safeguard
 */
export async function updateSafeguard(
  safeguardId: string,
  data: UpdateSafeguardInput,
  projectApiPath: string | null = null
): Promise<Safeguard> {
  const response = await api.put(
    `${basePath(projectApiPath)}/safeguards/${safeguardId}`,
    data
  );
  return response.data;
}

/**
 * Delete a safeguard
 */
export async function deleteSafeguard(
  safeguardId: string,
  projectApiPath: string | null = null
): Promise<void> {
  await api.delete(`${basePath(projectApiPath)}/safeguards/${safeguardId}`);
}

/**
 * Evaluate safeguards for a milestone
 */
export async function evaluateSafeguards(
  milestoneId: string,
  projectApiPath: string | null = null
): Promise<{
  results: SafeguardEvaluationResult[];
  anyTriggered: boolean;
}> {
  const response = await api.post(
    `${basePath(projectApiPath)}/milestones/${milestoneId}/safeguards/evaluate`
  );
  return response.data;
}

/**
 * Reset a triggered safeguard
 */
export async function resetSafeguard(
  safeguardId: string,
  projectApiPath: string | null = null
): Promise<void> {
  await api.post(`${basePath(projectApiPath)}/safeguards/${safeguardId}/reset`);
}

// ==================== Impact Metrics ====================

export interface AvailableMetric {
  name: string;
  help: string;
  type: string;
}

/**
 * Get available impact metrics for autocomplete
 */
export async function getAvailableMetrics(
  projectApiPath: string | null = null
): Promise<AvailableMetric[]> {
  const response = await api.get(
    `${projectApiPath || '/admin'}/impact-metrics/available`
  );
  return response.data || [];
}

const releaseFlowService = {
  getTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  applyTemplate,
  deletePlan,
  getPlan,
  startMilestone,
  startPlan,
  pausePlan,
  resumePlan,
  progressToNext,
  setTransitionCondition,
  removeTransitionCondition,
  listSafeguards,
  createSafeguard,
  updateSafeguard,
  deleteSafeguard,
  evaluateSafeguards,
  resetSafeguard,
  getAvailableMetrics,
};

export default releaseFlowService;
