/**
 * useIssueActions — Mutation actions for ArgusIssueDetailPage.
 *
 * Encapsulates all issue mutation logic with optimistic SWR updates.
 */
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import argusService, { ArgusIssueDetail } from '@/services/argusService';

interface UseIssueActionsOptions {
  projectId: string | undefined;
  issueId: string | undefined;
  issue: ArgusIssueDetail | null;
  updateIssueOptimistic: (
    updater: (prev: ArgusIssueDetail) => ArgusIssueDetail
  ) => void;
  revalidateIssue: () => void;
}

export function useIssueActions({
  projectId,
  issueId,
  issue,
  updateIssueOptimistic,
  revalidateIssue,
}: UseIssueActionsOptions) {
  const navigate = useNavigate();

  const changeStatus = useCallback(
    async (status: string) => {
      if (!projectId || !issueId || !issue) return;
      // Optimistic update
      updateIssueOptimistic((prev) => ({ ...prev, status }));
      try {
        await argusService.updateIssueStatus(projectId, issueId, status);
      } catch (error) {
        console.error('Failed to update status:', error);
        revalidateIssue(); // Rollback
      }
    },
    [projectId, issueId, issue, updateIssueOptimistic, revalidateIssue]
  );

  const assign = useCallback(
    async (assignee: string) => {
      if (!projectId || !issueId || !issue) return;
      updateIssueOptimistic((prev) => ({
        ...prev,
        assigned_to: assignee || null,
      }));
      try {
        await argusService.assignIssue(projectId, issueId, assignee || null);
      } catch (error) {
        console.error('Failed to assign issue:', error);
        revalidateIssue();
      }
    },
    [projectId, issueId, issue, updateIssueOptimistic, revalidateIssue]
  );

  const subscribe = useCallback(
    async (value: boolean) => {
      if (!projectId || !issueId) return;
      try {
        await argusService.subscribeIssue(projectId, issueId, value);
      } catch (error) {
        console.error('Failed to toggle subscription:', error);
      }
    },
    [projectId, issueId]
  );

  const bookmark = useCallback(
    async (value: boolean) => {
      if (!projectId || !issueId) return;
      try {
        await argusService.bookmarkIssue(projectId, issueId, value);
      } catch (error) {
        console.error('Failed to toggle bookmark:', error);
      }
    },
    [projectId, issueId]
  );

  const deleteIssue = useCallback(async () => {
    if (!projectId || !issueId) return;
    try {
      await argusService.deleteIssue(projectId, issueId);
      navigate(-1);
    } catch (error) {
      console.error('Failed to delete issue:', error);
    }
  }, [projectId, issueId, navigate]);

  const discardIssue = useCallback(async () => {
    if (!projectId || !issueId) return;
    try {
      await argusService.discardIssue(projectId, issueId);
      navigate(-1);
    } catch (error) {
      console.error('Failed to discard issue:', error);
    }
  }, [projectId, issueId, navigate]);

  const changePriority = useCallback(
    async (priority: string) => {
      if (!projectId || !issueId || !issue) return;
      updateIssueOptimistic((prev) => ({ ...prev, priority: priority as any }));
      try {
        await argusService.updateIssueStatus(projectId, issueId, issue.status);
      } catch (error) {
        console.error('Failed to update priority:', error);
        revalidateIssue();
      }
    },
    [projectId, issueId, issue, updateIssueOptimistic, revalidateIssue]
  );

  return {
    changeStatus,
    assign,
    subscribe,
    bookmark,
    deleteIssue,
    discardIssue,
    changePriority,
  };
}
