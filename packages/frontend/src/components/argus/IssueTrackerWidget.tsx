import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  useTheme,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Tooltip,
  CircularProgress,
  Link,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import useSWR from 'swr';
import GitHubIcon from '@mui/icons-material/GitHub';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import AddIcon from '@mui/icons-material/Add';
import SyncIcon from '@mui/icons-material/Sync';
import BugReportIcon from '@mui/icons-material/BugReport';
import { ArgusIssueDetail, ArgusIssueTracker, ArgusIssueLink } from '@/services/argusService';
import argusService from '@/services/argusService';

// SVG for Jira since it's not a standard Material Icon
const JiraIcon = (props: any) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      d="M11.53 2C6.28 2 2.03 6.25 2.03 11.5C2.03 16.75 6.28 21 11.53 21C16.78 21 21.03 16.75 21.03 11.5C21.03 6.25 16.78 2 11.53 2ZM15.97 8.81L11.12 15.5C11.04 15.61 10.93 15.69 10.8 15.74C10.68 15.78 10.54 15.79 10.41 15.75C10.28 15.72 10.16 15.65 10.07 15.55L7.34 12.56C7.17 12.38 7.18 12.09 7.36 11.92C7.54 11.75 7.83 11.76 8 11.94L10.52 14.69L15.17 8.31C15.32 8.11 15.61 8.07 15.81 8.22C16.01 8.37 16.05 8.65 15.9 8.85L15.97 8.81Z"
      fill="currentColor"
    />
  </svg>
);

const LinearIcon = (props: any) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM13.06 16.06L11.84 17.28C11.55 17.57 11.07 17.57 10.78 17.28L6.72 13.22C6.43 12.93 6.43 12.45 6.72 12.16L12.72 6.16C13.01 5.87 13.49 5.87 13.78 6.16L17.28 9.66C17.57 9.95 17.57 10.43 17.28 10.72L13.06 14.94V16.06Z"
      fill="currentColor"
    />
  </svg>
);

function getTrackerIcon(provider: string, props: any = { fontSize: 'small' }) {
  switch (provider) {
    case 'github':
      return <GitHubIcon {...props} />;
    case 'jira':
      return <JiraIcon width={18} height={18} {...props} />;
    case 'linear':
      return <LinearIcon width={18} height={18} {...props} />;
    default:
      return <BugReportIcon {...props} />;
  }
}

/** Map provider string to display name */
function getProviderDisplayName(provider: string): string {
  const map: Record<string, string> = {
    github: 'GitHub',
    jira: 'Jira',
    linear: 'Linear',
    clickup: 'ClickUp',
    asana: 'Asana',
    notion: 'Notion',
    azure_devops: 'Azure DevOps',
    youtrack: 'YouTrack',
    shortcut: 'Shortcut',
    trello: 'Trello',
    redmine: 'Redmine',
  };
  return map[provider] || provider;
}

interface IssueTrackerWidgetProps {
  projectId: string | number;
  issueId: string | number;
  issue?: ArgusIssueDetail;
  isDark: boolean;
  updateIssueOptimistic?: (
    updater: (prev: ArgusIssueDetail) => ArgusIssueDetail
  ) => void;
  revalidateIssue?: () => void;
}

interface LinkStatus {
  state: 'open' | 'closed' | 'unknown';
  synced?: boolean;
}

const IssueTrackerWidget: React.FC<IssueTrackerWidgetProps> = ({
  projectId,
  issueId,
  issue,
  isDark,
  updateIssueOptimistic,
  revalidateIssue,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [creatingId, setCreatingId] = useState<number | null>(null);
  const [unlinkTarget, setUnlinkTarget] = useState<ArgusIssueLink | null>(null);
  const [unlinking, setUnlinking] = useState(false);
  const [linkStatuses, setLinkStatuses] = useState<Record<number, LinkStatus>>({});
  const [syncingLinkId, setSyncingLinkId] = useState<number | null>(null);

  // Use links from issue detail response
  const links = issue?.links || [];
  const linkIds = links.map((l) => l.id).join(',');

  // Fetch configured trackers
  const { data: trackers, isLoading: loadingTrackers } = useSWR(
    projectId ? ['argus-issue-trackers', projectId] : null,
    ([_, pid]) => argusService.listIssueTrackers(pid)
  );

  const activeTrackers = trackers?.filter((t) => t.enabled) || [];

  // Determine which trackers are already linked
  const linkedTrackerIds = new Set(links.map((l) => l.tracker_id));

  // Trackers available for new linking (not already linked)
  const availableTrackers = activeTrackers.filter(
    (t) => !linkedTrackerIds.has(t.id)
  );

  // Auto-fetch status for all links
  useEffect(() => {
    if (links.length === 0) {
      setLinkStatuses({});
      return;
    }

    links.forEach((link) => {
      argusService
        .fetchIssueLinkStatus(projectId, issueId, link.id, true)
        .then((status) => {
          setLinkStatuses((prev) => ({
            ...prev,
            [link.id]: status,
          }));
          if (status.synced && revalidateIssue) revalidateIssue();
        })
        .catch(() => {
          setLinkStatuses((prev) => ({
            ...prev,
            [link.id]: { state: 'unknown' },
          }));
        });
    });
    // Re-run when links set changes (not just length)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkIds, projectId, issueId]);

  const handleSyncStatus = useCallback(
    async (link: ArgusIssueLink) => {
      setSyncingLinkId(link.id);
      try {
        const providerName = getProviderDisplayName(link.provider);
        const status = await argusService.fetchIssueLinkStatus(
          projectId,
          issueId,
          link.id,
          true
        );
        setLinkStatuses((prev) => ({ ...prev, [link.id]: status }));
        if (status.synced) {
          enqueueSnackbar(
            t('argus.issues.statusSynced', '{{provider}}에서 상태가 동기화되었습니다', {
              provider: providerName,
            }),
            { variant: 'success' }
          );
          if (revalidateIssue) revalidateIssue();
        } else if (status.state === 'open') {
          enqueueSnackbar(
            t('argus.issues.externalStillOpen', '{{provider}} 이슈가 아직 열려 있습니다', {
              provider: providerName,
            }),
            { variant: 'info' }
          );
        }
      } catch {
        enqueueSnackbar(t('common.error'), { variant: 'error' });
      } finally {
        setSyncingLinkId(null);
      }
    },
    [projectId, issueId, t, enqueueSnackbar, revalidateIssue]
  );

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleCreateExternalIssue = async (tracker: ArgusIssueTracker) => {
    handleClose();
    if (!issue) return;

    setCreatingId(tracker.id);
    try {
      // Form payload
      const payload = {
        title: `[${issue.level.toUpperCase()}] ${issue.title}`,
        description: `Error: ${issue.title}\nCulprit: ${issue.culprit}\n\nView in Gatrix: ${window.location.href}`,
        labels: ['bug', 'gatrix-argus'],
      };

      const res = await argusService.createExternalIssue(
        projectId,
        tracker.id,
        payload
      );

      if (res.url && res.key) {
        // Save link via new links API
        await argusService.addIssueLink(
          projectId,
          issueId,
          tracker.id,
          res.url,
          res.key
        );
        enqueueSnackbar(
          t('argus.issues.trackerIssueCreated', { key: res.key }),
          { variant: 'success' }
        );

        // Revalidate to refresh links array
        if (revalidateIssue) revalidateIssue();
      }
    } catch (error: any) {
      console.error(error);
      // Handle 409 Conflict (already linked) — just revalidate
      if (error.response?.status === 409) {
        enqueueSnackbar(
          t('argus.issues.trackerAlreadyLinked', '이 트래커에는 이미 연결되어 있습니다'),
          { variant: 'warning' }
        );
        if (revalidateIssue) revalidateIssue();
      } else {
        enqueueSnackbar(
          error.response?.data?.error ||
            t('argus.issues.trackerCreateFailed', 'Failed to create issue'),
          { variant: 'error' }
        );
      }
    } finally {
      setCreatingId(null);
    }
  };

  const handleUnlink = async () => {
    if (!unlinkTarget) return;
    setUnlinkTarget(null);
    setUnlinking(true);
    try {
      await argusService.removeIssueLink(projectId, issueId, unlinkTarget.id);
      enqueueSnackbar(
        t('argus.issues.trackerUnlinked', 'Issue unlinked successfully'),
        { variant: 'info' }
      );
      if (revalidateIssue) revalidateIssue();
    } catch {
      enqueueSnackbar(t('common.error'), { variant: 'error' });
    } finally {
      setUnlinking(false);
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 1,
        }}
      >
        <Typography
          variant="caption"
          fontWeight={700}
          sx={{
            fontSize: '0.7rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'text.secondary',
          }}
        >
          {t('argus.issues.issueTracking')}
        </Typography>
      </Box>

      {/* Linked Issues List */}
      {links.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 1 }}>
          {links.map((link) => {
            const status = linkStatuses[link.id];
            const providerName = getProviderDisplayName(link.provider);
            return (
              <Box
                key={link.id}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 0.5,
                  p: 1.5,
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                  borderRadius: 2,
                  backgroundColor: isDark
                    ? 'rgba(255,255,255,0.02)'
                    : 'rgba(0,0,0,0.02)',
                }}
              >
                {/* Link row */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    {getTrackerIcon(link.provider, { sx: { fontSize: 16, color: 'text.secondary' } })}
                    <Link
                      href={link.external_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        color: theme.palette.primary.main,
                        textDecoration: 'none',
                        '&:hover': { textDecoration: 'underline' },
                      }}
                    >
                      {link.external_key}
                      <OpenInNewIcon sx={{ fontSize: 14 }} />
                    </Link>
                  </Box>
                  <Tooltip title={t('argus.issues.unlink', 'Unlink Issue')}>
                    <IconButton
                      size="small"
                      onClick={() => setUnlinkTarget(link)}
                      disabled={unlinking}
                      sx={{ color: 'text.secondary' }}
                    >
                      {unlinking ? (
                        <CircularProgress size={16} color="inherit" />
                      ) : (
                        <LinkOffIcon sx={{ fontSize: 16 }} />
                      )}
                    </IconButton>
                  </Tooltip>
                </Box>

                {/* Status row */}
                {status && status.state !== 'unknown' && (
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      px: 1,
                      py: 0.5,
                      borderRadius: 1,
                      backgroundColor:
                        status.state === 'closed'
                          ? isDark
                            ? 'rgba(171,71,188,0.12)'
                            : 'rgba(142,36,170,0.08)'
                          : isDark
                            ? 'rgba(102,187,106,0.12)'
                            : 'rgba(46,125,50,0.08)',
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        color:
                          status.state === 'closed'
                            ? isDark
                              ? '#ce93d8'
                              : '#8e24aa'
                            : isDark
                              ? '#66bb6a'
                              : '#2e7d32',
                      }}
                    >
                      {status.state === 'closed'
                        ? t('argus.issues.externalClosed', '{{provider}}에서 닫힘', {
                            provider: providerName,
                          })
                        : t('argus.issues.externalOpen', '{{provider}}에서 열려 있음', {
                            provider: providerName,
                          })}
                    </Typography>
                    <Tooltip
                      title={t('argus.issues.syncStatus', '{{provider}}에서 상태 동기화', {
                        provider: providerName,
                      })}
                    >
                      <IconButton
                        size="small"
                        onClick={() => handleSyncStatus(link)}
                        disabled={syncingLinkId === link.id}
                        sx={{ color: 'text.secondary', p: 0.25 }}
                      >
                        {syncingLinkId === link.id ? (
                          <CircularProgress size={14} color="inherit" />
                        ) : (
                          <SyncIcon sx={{ fontSize: 14 }} />
                        )}
                      </IconButton>
                    </Tooltip>
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>
      )}

      {/* Add Link Button (always visible when there are available trackers) */}
      {loadingTrackers ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 1 }}>
          <CircularProgress size={20} />
        </Box>
      ) : availableTrackers.length > 0 ? (
        <Button
          variant="outlined"
          size="small"
          fullWidth
          startIcon={<AddIcon />}
          onClick={handleClick}
          sx={{
            justifyContent: 'flex-start',
            textTransform: 'none',
            fontWeight: 600,
            color: 'text.secondary',
            borderColor: isDark
              ? 'rgba(255,255,255,0.1)'
              : 'rgba(0,0,0,0.1)',
          }}
        >
          {links.length > 0
            ? t('argus.issues.addLink', '트래커 연결 추가')
            : t('argus.issues.createExternalIssue', 'Create External Issue')}
        </Button>
      ) : activeTrackers.length === 0 && links.length === 0 ? (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 0.75,
          }}
        >
          <Typography
            variant="body2"
            sx={{
              color: 'text.disabled',
              fontStyle: 'italic',
              fontSize: '0.8rem',
            }}
          >
            {t(
              'argus.issues.noTrackersConfigured',
              'No issue trackers configured for this project.'
            )}
          </Typography>
          <Link
            component="button"
            onClick={() => navigate('/argus/settings#issue-trackers')}
            sx={{
              fontSize: '0.75rem',
              fontWeight: 600,
              textDecoration: 'none',
              color: theme.palette.primary.main,
              cursor: 'pointer',
              textAlign: 'left',
              '&:hover': { textDecoration: 'underline' },
            }}
          >
            {t('argus.issues.configureTrackers', 'Configure in Settings →')}
          </Link>
        </Box>
      ) : null}

      {/* Trackers Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        slotProps={{
          paper: {
            sx: {
              borderRadius: 2,
              minWidth: 220,
              boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
            },
          },
        }}
      >
        {availableTrackers.map((tracker) => (
          <MenuItem
            key={tracker.id}
            onClick={() => handleCreateExternalIssue(tracker)}
            disabled={creatingId !== null}
          >
            <ListItemIcon>
              {creatingId === tracker.id ? (
                <CircularProgress size={16} />
              ) : (
                getTrackerIcon(tracker.provider)
              )}
            </ListItemIcon>
            <ListItemText
              primary={t('argus.issues.createIn', { name: tracker.name })}
              primaryTypographyProps={{ fontSize: '0.85rem' }}
            />
          </MenuItem>
        ))}
      </Menu>

      {/* Unlink confirmation dialog */}
      <Dialog
        open={!!unlinkTarget}
        onClose={() => setUnlinkTarget(null)}
        maxWidth="xs"
      >
        <DialogTitle>{t('argus.issues.unlinkConfirmTitle', '이슈 연결 해제')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('argus.issues.unlinkConfirmDetail', '{{key}} 연결을 해제하시겠습니까?', {
              key: unlinkTarget?.external_key || '',
            })}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUnlinkTarget(null)}>
            {t('common.cancel', '취소')}
          </Button>
          <Button onClick={handleUnlink} color="error" variant="contained" autoFocus>
            {t('argus.issues.unlinkAction', '연결 해제')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default IssueTrackerWidget;
