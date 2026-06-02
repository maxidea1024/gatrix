/**
 * useIssueDetailData — SWR-based data fetching for ArgusIssueDetailPage.
 *
 * Replaces manual useState + useEffect data loading with SWR's
 * built-in caching, revalidation, and error handling.
 */
import { useCallback, useState } from 'react';
import useSWR, { mutate } from 'swr';
import argusService, {
  ArgusIssueDetail,
  ArgusErrorEvent,
  ArgusTraceDetail,
  ArgusLogEntry,
} from '@/services/argusService';
import { rbacService } from '@/services/rbacService';

// ==================== SWR Fetchers ====================

const issueFetcher = async ([_, projectId, issueId]: [string, string, string]) => {
  return argusService.getIssueDetail(projectId, issueId);
};

const membersFetcher = async ([_, projectId]: [string, string]) => {
  return rbacService.getProjectMembers(projectId);
};

const traceFetcher = async ([_, projectId, traceId]: [string, string, string]) => {
  return argusService.getTraceDetail(projectId, traceId);
};

const logsFetcher = async ([_, projectId, issueId]: [string, string, string]) => {
  return argusService.getLogs(projectId, { issue_id: issueId, limit: 200, order: 'DESC' });
};

// ==================== Hook ====================

interface UseIssueDetailDataOptions {
  projectId: string | undefined;
  issueId: string | undefined;
}

export function useIssueDetailData({ projectId, issueId }: UseIssueDetailDataOptions) {
  // --- Issue Detail (SWR) ---
  const issueKey = projectId && issueId ? ['argus-issue', projectId, issueId] : null;
  const {
    data: issue,
    error: issueError,
    isLoading: issueLoading,
    mutate: mutateIssue,
  } = useSWR<ArgusIssueDetail>(
    issueKey,
    issueFetcher as any,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
    }
  );

  // --- Project Members (SWR) ---
  const membersKey = projectId ? ['argus-members', projectId] : null;
  const {
    data: members = [],
  } = useSWR<any[]>(
    membersKey,
    membersFetcher as any,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // members rarely change
    }
  );

  // --- Optimistic Issue Update ---
  const updateIssueOptimistic = useCallback(
    (updater: (prev: ArgusIssueDetail) => ArgusIssueDetail) => {
      if (!issue) return;
      mutateIssue(updater(issue), { revalidate: false });
    },
    [issue, mutateIssue]
  );

  // --- Revalidate ---
  const revalidateIssue = useCallback(() => {
    mutateIssue();
  }, [mutateIssue]);

  return {
    // Issue
    issue: issue ?? null,
    issueLoading,
    issueError,
    mutateIssue,
    updateIssueOptimistic,
    revalidateIssue,

    // Members
    members,
  };
}

// ==================== Trace Hook ====================

export function useTraceData(projectId: string | undefined, traceId: string | null, enabled: boolean) {
  const traceKey = projectId && traceId && enabled ? ['argus-trace', projectId, traceId] : null;
  const {
    data: traceDetail,
    error: traceError,
    isLoading: traceLoading,
  } = useSWR<ArgusTraceDetail>(
    traceKey,
    traceFetcher as any,
    {
      revalidateOnFocus: false,
    }
  );

  return {
    traceDetail: traceDetail ?? null,
    traceLoading,
    traceError,
  };
}


// ==================== Logs Hook ====================

export function useLogsData(projectId: string | undefined, issueId: string | undefined, enabled: boolean) {
  const logsKey = projectId && issueId && enabled ? ['argus-logs', projectId, issueId] : null;
  const {
    data: logsResult,
    error: logsError,
    isLoading: logsLoading,
    mutate,
  } = useSWR(
    logsKey,
    logsFetcher as any,
    {
      revalidateOnFocus: false,
    }
  );

  const [isFetchingMore, setIsFetchingMore] = useState(false);

  const loadMoreLogs = useCallback(async () => {
    if (!projectId || !issueId || !logsResult) return;
    const currentData = (logsResult as any).data as ArgusLogEntry[];
    const lastLog = currentData[currentData.length - 1];
    
    setIsFetchingMore(true);
    try {
      const moreLogs = await argusService.getLogs(projectId, {
        issue_id: issueId,
        limit: 200,
        order: 'DESC',
        cursor: lastLog?.timestamp,
      });

      // Mutate SWR cache by appending new logs and updating hasMore
      mutate(
        {
          data: [...currentData, ...moreLogs.data],
          meta: moreLogs.meta,
        },
        false // Don't revalidate immediately
      );
    } catch (error) {
      console.error('Failed to load more logs:', error);
    } finally {
      setIsFetchingMore(false);
    }
  }, [projectId, issueId, logsResult, mutate]);

  return {
    logs: (logsResult as any)?.data as ArgusLogEntry[] ?? [],
    logsHasMore: (logsResult as any)?.meta?.hasMore ?? false,
    logsLoading,
    logsError,
    loadMoreLogs,
    isFetchingMore,
  };
}
