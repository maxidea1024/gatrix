import React from 'react';
import {
  Box,
  Typography,
  Divider,
  useTheme,
  alpha,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { ArgusIssueDetail, ArgusErrorEvent } from '@/services/argusService';
import SuspectCommits from '@/components/argus/SuspectCommits';
import IssueTrackerWidget from '@/components/argus/IssueTrackerWidget';
import SimilarMergedIssues from '@/components/argus/SimilarMergedIssues';
import ActivityTimeline from '@/components/argus/ActivityTimeline';
import PresenceIndicator from '@/components/argus/PresenceIndicator';
import TagDistribution from '@/components/argus/TagDistribution';

export interface IssueDetailSidebarProps {
  issue: ArgusIssueDetail;
  latestEvent: ArgusErrorEvent | null;
  projectId: string;
  issueId: string;
  isDark: boolean;
  updateIssueOptimistic?: (updater: (prev: ArgusIssueDetail) => ArgusIssueDetail) => void;
  revalidateIssue?: () => void;
}

const IssueDetailSidebar: React.FC<IssueDetailSidebarProps> = ({
  issue,
  latestEvent,
  projectId,
  issueId,
  isDark,
  updateIssueOptimistic,
  revalidateIssue,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <>
      {/* First/Last Seen + Release */}
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2 }}>
          <Box>
            <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.disabled', display: 'block', mb: 0.2 }}>
              {t('argus.issues.firstSeen')}
            </Typography>
            <Typography variant="body2" sx={{ fontSize: '0.78rem', fontWeight: 600, color: 'text.primary' }}>
              {issue.first_seen ? new Date(issue.first_seen).toLocaleString() : '—'}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.disabled', display: 'block', mb: 0.2 }}>
              {t('argus.issues.lastSeen')}
            </Typography>
            <Typography variant="body2" sx={{ fontSize: '0.78rem', fontWeight: 600, color: 'text.primary' }}>
              {issue.last_seen ? new Date(issue.last_seen).toLocaleString() : '—'}
            </Typography>
          </Box>
          {latestEvent?.release && (
            <Box>
              <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.disabled', display: 'block', mb: 0.2 }}>
                {t('argus.detail.release')}
              </Typography>
              <Typography variant="body2" sx={{ fontSize: '0.78rem', fontWeight: 600, color: theme.palette.info.main }}>
                {latestEvent.release}
              </Typography>
            </Box>
          )}
          {latestEvent?.environment && (
            <Box>
              <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.disabled', display: 'block', mb: 0.2 }}>
                {t('argus.issues.environment')}
              </Typography>
              <Typography variant="body2" sx={{ fontSize: '0.78rem', fontWeight: 600 }}>
                {latestEvent.environment}
              </Typography>
            </Box>
          )}
        </Box>
      </Box>

      <Divider sx={{ mb: 2 }} />

      {/* Suspect Commits */}
      {projectId && issueId && (
        <SuspectCommits projectId={projectId} issueId={issueId} isDark={isDark} />
      )}

      {/* Issue Tracking */}
      {projectId && issueId && (
        <Box sx={{ mb: 2 }}>
          <IssueTrackerWidget 
            projectId={projectId} 
            issueId={issueId} 
            issue={issue}
            isDark={isDark} 
            updateIssueOptimistic={updateIssueOptimistic}
            revalidateIssue={revalidateIssue}
          />
        </Box>
      )}

      <Divider sx={{ mb: 2 }} />

      {/* Similar / Merged Issues */}
      {projectId && issueId && issue.fingerprint && (
        <SimilarMergedIssues
          projectId={projectId}
          issueId={issueId}
          fingerprint={issue.fingerprint}
          isDark={isDark}
        />
      )}

      {/* Activity */}
      {projectId && issueId && (
        <Box sx={{ mb: 2 }}>
          <ActivityTimeline
            projectId={projectId}
            issueId={issueId}
            isDark={isDark}
            embedded
          />
        </Box>
      )}

      <Divider sx={{ mb: 2 }} />

      {/* People — Presence */}
      {projectId && issueId && (
        <Box>
          <Typography variant="caption" fontWeight={700} sx={{
            fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em',
            color: 'text.secondary', mb: 1, display: 'block',
          }}>
            {t('argus.issues.people', 'People')}
          </Typography>
          <PresenceIndicator projectId={projectId} resourceId={issueId} resourceType="issue" currentUser={{ id: 'current-user', name: 'You' }} isDark={isDark} />
        </Box>
      )}

      <Divider sx={{ my: 2 }} />

      {/* Tag Distribution */}
      {projectId && issueId && (
        <TagDistribution projectId={projectId} issueId={issueId} isDark={isDark} />
      )}
    </>
  );
};

export default IssueDetailSidebar;
