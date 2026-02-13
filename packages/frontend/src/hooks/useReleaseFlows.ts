import { useApi, useConditionalApi } from './useSWR';
import {
    ReleaseFlowTemplate,
    ReleaseFlowPlan
} from '@/services/releaseFlowService';

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
export function useReleaseFlowPlan(flagId: string | null, environment: string | null) {
    const url = (flagId && environment)
        ? `/admin/release-flows/plans/${flagId}/${environment}`
        : null;

    return useApi<ReleaseFlowPlan>(url);
}

/**
 * Hook for conditional release flow plan loading
 */
export function useConditionalReleaseFlowPlan(
    flagId: string | null,
    environment: string | null,
    condition: boolean
) {
    const url = (flagId && environment)
        ? `/admin/release-flows/plans/${flagId}/${environment}`
        : null;

    return useConditionalApi<ReleaseFlowPlan>(url, condition);
}

export interface ReleaseFlowPlanSummary {
    environment: string;
    status: string;
    displayName: string;
}

/**
 * Hook for fetching all active release flow plans for a flag
 */
export function useReleaseFlowPlansByFlag(flagId: string | null) {
    const url = flagId
        ? `/admin/release-flows/plans/flag/${flagId}`
        : null;

    return useApi<ReleaseFlowPlanSummary[]>(url);
}
