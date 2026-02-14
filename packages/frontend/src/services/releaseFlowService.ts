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
  environment: string;
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
  environment: string;
  templateId: string;
}

// ==================== Service ====================

/**
 * List all templates
 */
export async function getTemplates(search?: string): Promise<ReleaseFlowTemplate[]> {
  const response = await api.get('/admin/release-flows/templates', { params: { search } });
  return response.data || [];
}

/**
 * Create a new template
 */
export async function createTemplate(data: CreateTemplateInput): Promise<ReleaseFlowTemplate> {
  const response = await api.post('/admin/release-flows/templates', data);
  return response.data;
}

/**
 * Apply a template to a feature flag and environment
 */
export async function applyTemplate(data: ApplyTemplateInput): Promise<ReleaseFlowPlan> {
  const response = await api.post('/admin/release-flows/apply', data);
  return response.data;
}

/**
 * Get the active release plan for a flag and environment
 */
export async function getPlan(
  flagId: string,
  environment: string
): Promise<ReleaseFlowPlan | null> {
  const response = await api.get(`/admin/release-flows/plans/${flagId}/${environment}`);
  return response.data;
}

/**
 * Start a milestone in a release plan
 */
export async function startMilestone(planId: string, milestoneId: string): Promise<void> {
  await api.post(`/admin/release-flows/plans/${planId}/milestones/${milestoneId}/start`);
}

/**
 * Get a single template by ID (with milestones and strategies)
 */
export async function getTemplate(id: string): Promise<ReleaseFlowTemplate> {
  const response = await api.get(`/admin/release-flows/templates/${id}`);
  return response.data;
}

/**
 * Update an existing template
 */
export async function updateTemplate(
  id: string,
  data: Partial<CreateTemplateInput>
): Promise<ReleaseFlowTemplate> {
  const response = await api.put(`/admin/release-flows/templates/${id}`, data);
  return response.data;
}

/**
 * Delete (archive) a template
 */
export async function deleteTemplate(id: string): Promise<void> {
  await api.delete(`/admin/release-flows/templates/${id}`);
}

// ==================== Plan Lifecycle ====================

/**
 * Start a release plan (begins from first milestone)
 */
export async function startPlan(planId: string): Promise<ReleaseFlowPlan> {
  const response = await api.post(`/admin/release-flows/plans/${planId}/start`);
  return response.data;
}

/**
 * Pause a running release plan
 */
export async function pausePlan(planId: string): Promise<ReleaseFlowPlan> {
  const response = await api.post(`/admin/release-flows/plans/${planId}/pause`);
  return response.data;
}

/**
 * Resume a paused release plan
 */
export async function resumePlan(planId: string): Promise<ReleaseFlowPlan> {
  const response = await api.post(`/admin/release-flows/plans/${planId}/resume`);
  return response.data;
}

/**
 * Progress to the next milestone manually
 */
export async function progressToNext(planId: string): Promise<ReleaseFlowPlan> {
  const response = await api.post(`/admin/release-flows/plans/${planId}/progress`);
  return response.data;
}

/**
 * Set transition condition on a milestone
 */
export async function setTransitionCondition(
  milestoneId: string,
  intervalMinutes: number
): Promise<ReleaseFlowMilestone> {
  const response = await api.put(`/admin/release-flows/milestones/${milestoneId}/transition`, {
    intervalMinutes,
  });
  return response.data;
}

/**
 * Remove transition condition from a milestone
 */
export async function removeTransitionCondition(
  milestoneId: string
): Promise<ReleaseFlowMilestone> {
  const response = await api.delete(`/admin/release-flows/milestones/${milestoneId}/transition`);
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
export async function listSafeguards(milestoneId: string): Promise<Safeguard[]> {
  const response = await api.get(`/admin/release-flows/milestones/${milestoneId}/safeguards`);
  return response.data || [];
}

/**
 * Create a safeguard
 */
export async function createSafeguard(data: CreateSafeguardInput): Promise<Safeguard> {
  const response = await api.post('/admin/release-flows/safeguards', data);
  return response.data;
}

/**
 * Update a safeguard
 */
export async function updateSafeguard(
  safeguardId: string,
  data: UpdateSafeguardInput
): Promise<Safeguard> {
  const response = await api.put(`/admin/release-flows/safeguards/${safeguardId}`, data);
  return response.data;
}

/**
 * Delete a safeguard
 */
export async function deleteSafeguard(safeguardId: string): Promise<void> {
  await api.delete(`/admin/release-flows/safeguards/${safeguardId}`);
}

/**
 * Evaluate safeguards for a milestone
 */
export async function evaluateSafeguards(milestoneId: string): Promise<{
  results: SafeguardEvaluationResult[];
  anyTriggered: boolean;
}> {
  const response = await api.post(
    `/admin/release-flows/milestones/${milestoneId}/safeguards/evaluate`
  );
  return response.data;
}

/**
 * Reset a triggered safeguard
 */
export async function resetSafeguard(safeguardId: string): Promise<void> {
  await api.post(`/admin/release-flows/safeguards/${safeguardId}/reset`);
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
export async function getAvailableMetrics(): Promise<AvailableMetric[]> {
  const response = await api.get('/admin/impact-metrics/available');
  return response.data || [];
}

const releaseFlowService = {
  getTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  applyTemplate,
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
