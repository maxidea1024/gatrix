import { useApi, useConditionalApi } from './useSWR';
import { ReleaseFlowTemplate, ReleaseFlowPlan } from '@/services/releaseFlowService';
import { useOrgProject } from '@/contexts/OrgProjectContext';

/**
 * Hook for release flow templates
 */
export function useReleaseFlowTemplates(search?: string) {
  const { getProjectApiPath } = useOrgProject();
  const projectApiPath = getProjectApiPath();

  const url = search
    ? `${projectApiPath}/release-flows/templates?search=${encodeURIComponent(search)}`
    : `${projectApiPath}/release-flows/templates`;

  return useApi<ReleaseFlowTemplate[]>(url);
}

/**
 * Hook for a specific release flow plan for a flag and environment
 */
export function useReleaseFlowPlan(flagId: string | null, environmentId: string | null) {
  const { getProjectApiPath } = useOrgProject();
  const projectApiPath = getProjectApiPath();

  const url =
    flagId && environmentId
      ? `${projectApiPath}/release-flows/plans/${flagId}/${environmentId}`
      : null;

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
  const { getProjectApiPath } = useOrgProject();
  const projectApiPath = getProjectApiPath();

  const url =
    flagId && environmentId
      ? `${projectApiPath}/release-flows/plans/${flagId}/${environmentId}`
      : null;

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
  const { getProjectApiPath } = useOrgProject();
  const projectApiPath = getProjectApiPath();

  const url = flagId ? `${projectApiPath}/release-flows/plans/flag/${flagId}` : null;

  return useApi<ReleaseFlowPlanSummary[]>(url);
}
