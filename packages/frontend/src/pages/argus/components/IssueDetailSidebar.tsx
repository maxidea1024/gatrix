import React from 'react';
import { Box, Typography, Divider, useTheme } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { ArgusIssueDetail, ArgusErrorEvent } from '@/services/argusService';
import { formatRelativeTime } from '@/utils/dateFormat';
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
  updateIssueOptimistic?: (
    updater: (prev: ArgusIssueDetail) => ArgusIssueDetail
  ) => void;
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
  const { t, i18n } = useTranslation();

  return (
    <>
      {/* First/Last Seen + Release */}
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Typography
              variant="caption"
              sx={{ fontSize: '0.7rem', color: 'text.secondary' }}
            >
              {t('argus.issues.firstSeen')}
            </Typography>
            <Typography
              variant="body2"
              sx={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'text.primary',
              }}
            >
              {issue.first_seen
                ? formatRelativeTime(issue.first_seen, undefined, i18n.language)
                : '—'}
            </Typography>
          </Box>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Typography
              variant="caption"
              sx={{ fontSize: '0.7rem', color: 'text.secondary' }}
            >
              {t('argus.issues.lastSeen')}
            </Typography>
            <Typography
              variant="body2"
              sx={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'text.primary',
              }}
            >
              {issue.last_seen
                ? formatRelativeTime(issue.last_seen, undefined, i18n.language)
                : '—'}
            </Typography>
          </Box>
          {latestEvent?.release && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Typography
                variant="caption"
                sx={{ fontSize: '0.7rem', color: 'text.secondary' }}
              >
                {t('argus.detail.release')}
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: theme.palette.info.main,
                }}
              >
                {latestEvent.release}
              </Typography>
            </Box>
          )}
          {latestEvent?.environment && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Typography
                variant="caption"
                sx={{ fontSize: '0.7rem', color: 'text.secondary' }}
              >
                {t('argus.issues.environment')}
              </Typography>
              <Typography
                variant="body2"
                sx={{ fontSize: '0.75rem', fontWeight: 600 }}
              >
                {latestEvent.environment}
              </Typography>
            </Box>
          )}
        </Box>
      </Box>

      <Divider sx={{ mb: 2 }} />

      {/* Suspect Commits */}
      {projectId && issueId && (
        <SuspectCommits
          projectId={projectId}
          issueId={issueId}
          isDark={isDark}
        />
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
          <Typography
            variant="caption"
            fontWeight={700}
            sx={{
              fontSize: '0.7rem',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'text.secondary',
              mb: 1,
              display: 'block',
            }}
          >
            {t('argus.issues.people', 'People')}
          </Typography>
          <PresenceIndicator
            projectId={projectId}
            resourceId={issueId}
            resourceType="issue"
            currentUser={{ id: 'current-user', name: 'You' }}
            isDark={isDark}
          />
        </Box>
      )}

      <Divider sx={{ my: 2 }} />

      {/* Tag Distribution */}
      {projectId && issueId && (
        <TagDistribution
          projectId={projectId}
          issueId={issueId}
          isDark={isDark}
        />
      )}
    </>
  );
};

export default React.memo(IssueDetailSidebar);
