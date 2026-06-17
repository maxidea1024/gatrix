/**
 * useSharedEventCatalog
 *
 * Fetches and caches the analytics event name list in the shared
 * useEventCatalogStore. Multiple pages calling this hook will only trigger
 * one network request per project — subsequent callers receive the cached
 * list immediately (no loading flash).
 *
 * Cache is invalidated when `projectId` changes.
 */
import { useEffect, useCallback } from 'react';
import argusService from '@/services/argusService';
import { useEventCatalogStore } from '@/hooks/useAnalyticsStore';

export function useSharedEventCatalog(projectId: string) {
  const availableEvents = useEventCatalogStore((s) => s.availableEvents);
  const eventsLoading = useEventCatalogStore((s) => s.eventsLoading);
  const isCacheValid = useEventCatalogStore((s) => s.isCacheValid);
  const setAvailableEvents = useEventCatalogStore((s) => s.setAvailableEvents);
  const setEventsLoading = useEventCatalogStore((s) => s.setEventsLoading);

  const fetchEventNames = useCallback(async () => {
    // Skip if cache is already warm for this project
    if (isCacheValid(projectId)) return;

    setEventsLoading(true);
    try {
      const data = await argusService.getAnalyticsEventNames(projectId, '30d');
      setAvailableEvents(data, projectId);
    } catch {
      setAvailableEvents([], projectId);
    } finally {
      setEventsLoading(false);
    }
  }, [projectId, isCacheValid, setAvailableEvents, setEventsLoading]);

  useEffect(() => {
    fetchEventNames();
  }, [fetchEventNames]);

  return { availableEvents, eventsLoading, refetch: fetchEventNames };
}
