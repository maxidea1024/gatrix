/**
 * useBreakdownLimit — fetch the project's analytics_breakdown_limit setting.
 *
 * Returns a numeric limit (default 20) that analytics pages should use
 * to cap the number of breakdown series displayed in charts/tables.
 */
import { useState, useEffect } from 'react';
import argusService, { ArgusProject } from '@/services/argusService';

const DEFAULT_BREAKDOWN_LIMIT = 20;

export function useBreakdownLimit(projectId: string | number): number {
  const [limit, setLimit] = useState(DEFAULT_BREAKDOWN_LIMIT);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const project: ArgusProject = await argusService.getProject(projectId);
        if (!cancelled) {
          setLimit(
            project.analytics_breakdown_limit || DEFAULT_BREAKDOWN_LIMIT
          );
        }
      } catch {
        // keep default
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return limit;
}

/**
 * Utility: Given a series array, sort by total value descending and keep
 * only the top-N. Works for any series that has a `data` array of `{ value }`.
 */
export function limitBreakdownSeries<T extends { data: { value: number }[] }>(
  series: T[],
  limit: number
): T[] {
  if (series.length <= limit) return series;
  return [...series]
    .sort((a, b) => {
      const sumA = a.data.reduce((acc, d) => acc + (d.value || 0), 0);
      const sumB = b.data.reduce((acc, d) => acc + (d.value || 0), 0);
      return sumB - sumA;
    })
    .slice(0, limit);
}
