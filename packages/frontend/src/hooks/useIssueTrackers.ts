/**
 * useIssueTrackers — SWR-based hook for fetching and interacting with Argus Issue Trackers.
 */
import useSWR from 'swr';
import { useCallback, useState } from 'react';
import argusService, { ArgusIssueTracker } from '@/services/argusService';

const trackersFetcher = async ([_, projectId]: [string, string]) => {
  return argusService.listIssueTrackers(projectId);
};

export function useIssueTrackers(projectId: string | undefined) {
  const trackerKey = projectId ? ['argus-issue-trackers', projectId] : null;

  const {
    data: trackers = [],
    error,
    isLoading,
    mutate,
  } = useSWR<ArgusIssueTracker[]>(trackerKey, trackersFetcher as any, {
    revalidateOnFocus: false,
    dedupingInterval: 10000,
  });

  const [sendingTrackerId, setSendingTrackerId] = useState<number | null>(null);

  const sendToTracker = useCallback(
    async (
      trackerId: number,
      issuePayload: { title: string; description?: string; url?: string }
    ) => {
      if (!projectId) return;
      setSendingTrackerId(trackerId);
      try {
        const result = await argusService.createExternalIssue(
          projectId,
          trackerId,
          issuePayload
        );
        return result;
      } finally {
        setSendingTrackerId(null);
      }
    },
    [projectId]
  );

  return {
    trackers,
    isLoading,
    error,
    mutateTrackers: mutate,
    sendingTrackerId,
    sendToTracker,
  };
}
