import { useApi, useConditionalApi } from './useSWR';
import { ReleaseFlowTemplate, ReleaseFlowPlan } from '@/services/releaseFlowService';

/**
 * Hook for release flow templates
 */
export function useReleaseFlowTemplates(search?: string) {
  const url = search
    ? `/admin/release-flows/templates?search=${encodeURIComponent(search)}`
    : '/admin/release-flows/templates';

  return useApi<ReleaseFlowTemplate[]>(url);
}

/**
 * Hook for a specific release flow plan for a flag and environment
 */
export function useReleaseFlowPlan(flagId: string | null, environmentId: string | null) {
  const url = flagId && environmentId ? `/admin/release-flows/plans/${flagId}/${ environmentId }` : null;

  return useApi<ReleaseFlowPlan>(url);
}

/**
 * Hook for conditional release flow plan loading
 */
export function useConditionalReleaseFlowPlan(
  flagId: string | null,
  environmentId: string | null,
  condition: boolean
) {
  const url = flagId && environmentId ? `/admin/release-flows/plans/${flagId}/${ environmentId }` : null;

  return useConditionalApi<ReleaseFlowPlan>(url, condition);
}

export interface ReleaseFlowPlanSummary {
  environmentId: string;
  status: string;
  displayName: string;
  activeMilestoneName: string | null;
}

/**
 * Hook for fetching all active release flow plans for a flag
 */
export function useReleaseFlowPlansByFlag(flagId: string | null) {
  const url = flagId ? `/admin/release-flows/plans/flag/${flagId}` : null;

  return useApi<ReleaseFlowPlanSummary[]>(url);
}
