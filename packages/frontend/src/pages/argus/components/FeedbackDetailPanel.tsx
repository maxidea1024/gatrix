import React, { useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Avatar,
  Divider,
  IconButton,
  Dialog,
  DialogContent,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  alpha,
} from '@mui/material';
import {
  Link as LinkIcon,
  CheckCircleOutline as ResolveIcon,
  ReportProblem as SpamIcon,
  Undo as UnresolveIcon,
  BugReport as BugReportIcon,
  Image as ImageIcon,
  Close as CloseIcon,
  PersonAdd as AssignIcon,
  OpenInNew as OpenIcon,
  Person as PersonIcon,
  Add as AddIcon,
  Mail as MailIcon,
  Language as UrlIcon,
  Dns as EnvIcon,
  NewReleases as ReleaseIcon,
  LocalOffer as TagIcon,
  Source as SourceIcon,
  Computer as BrowserIcon,
  PhoneAndroid as DeviceIcon,
  Public as OsIcon,
  AccountCircle as UserIdIcon,
  FilterList as FilterAddIcon,
  FilterListOff as FilterExcludeIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ArgusFeedbackItem, ArgusIssue } from '@/services/argusService';
import { formatRelativeTime } from '@/utils/dateFormat';
import { formatWithCommas } from '@/utils/numberFormat';
import { stringToColor, getInitials } from '@/utils/argusHelpers';
import { CopyButton } from '@/components/common/CopyButton';
import FeedbackActivityTimeline from './FeedbackActivityTimeline';
import {
  DetailContainer,
  DetailHeader,
  DetailToolbar,
  DetailBody,
  ToolbarButtonGroup,
  ToolbarButton,
  ToolbarDivider,
  MessagePaper,
  LinkedIssuePaper,
  LinkedIssueHeaderBar,
  CardActionButton,
  MetadataPaper,
  MetadataRow,
  SectionTitle,
  StatusChip,
  IssueStatusChip,
  TagChip,
  AttachmentThumbnail,
} from './FeedbackDetailPanel.styles';
import { ARGUS_SEMANTIC } from '../argusThemeTokens';

const statusColor = (s: string) => {
  if (s === 'resolved') return ARGUS_SEMANTIC.positive;
  if (s === 'spam') return '#9e9e9e';
  return ARGUS_SEMANTIC.warning;
};

interface FeedbackDetailPanelProps {
  selectedItem: ArgusFeedbackItem;
  isDark: boolean;
  projectId: string;
  members: any[];
  linkedIssueDetail: ArgusIssue | null;
  onUpdateStatus: (feedbackId: string, status: string) => void;
  onMarkSpam: (feedbackId: string) => void;
  onAssignFeedback: (feedbackId: string, assignee: string) => void;
  onUnlinkIssue: () => void;
  onOpenCreateIssue: () => void;
  onOpenLinkIssue: () => void;
  onAddFilter?: (field: string, value: string, exclude?: boolean) => void;
}

const FeedbackDetailPanel: React.FC<FeedbackDetailPanelProps> = ({
  selectedItem,
  isDark,
  projectId,
  members,
  linkedIssueDetail,
  onUpdateStatus,
  onMarkSpam,
  onAssignFeedback,
  onUnlinkIssue,
  onOpenCreateIssue,
  onOpenLinkIssue,
  onAddFilter,
}) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [assigneeAnchor, setAssigneeAnchor] = useState<{
    el: HTMLElement;
    feedbackId: string;
  } | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const handleAssign = useCallback(
    (assignee: string) => {
      if (assigneeAnchor) {
        onAssignFeedback(assigneeAnchor.feedbackId, assignee);
      }
      setAssigneeAnchor(null);
    },
    [assigneeAnchor, onAssignFeedback]
  );

  const navigateToIssue = useCallback(
    (issueId: number) =>
      navigate(`/argus/issues/${projectId}/${issueId}`, {
        state: { from: 'feedback' },
      }),
    [navigate, projectId]
  );

  // ─── Metadata rows ───
  const metadataRows = [
    {
      icon: <UrlIcon sx={{ fontSize: 14 }} />,
      label: 'URL',
      value: selectedItem.url,
      field: 'url',
    },
    {
      icon: <MailIcon sx={{ fontSize: 14 }} />,
      label: t('argus.feedback.contactEmail'),
      value: selectedItem.contact_email,
      field: 'contact_email',
    },
    {
      icon: <EnvIcon sx={{ fontSize: 14 }} />,
      label: t('argus.feedback.environment'),
      value: selectedItem.environment,
      field: 'environment',
    },
    {
      icon: <ReleaseIcon sx={{ fontSize: 14 }} />,
      label: t('argus.feedback.release'),
      value: selectedItem.release,
      field: 'release',
    },
    {
      icon: <SourceIcon sx={{ fontSize: 14 }} />,
      label: t('argus.feedback.source'),
      value: selectedItem.source,
      field: 'source',
    },
    {
      icon: <BrowserIcon sx={{ fontSize: 14 }} />,
      label: t('argus.feedback.browser'),
      value: selectedItem.browser
        ? `${selectedItem.browser}${selectedItem.browser_version ? ` ${selectedItem.browser_version}` : ''}`
        : '',
      field: 'browser_name',
      rawValue: selectedItem.browser,
    },
    {
      icon: <OsIcon sx={{ fontSize: 14 }} />,
      label: t('argus.feedback.os'),
      value: selectedItem.os
        ? `${selectedItem.os}${selectedItem.os_version ? ` ${selectedItem.os_version}` : ''}`
        : '',
      field: 'os_name',
      rawValue: selectedItem.os,
    },
    {
      icon: <DeviceIcon sx={{ fontSize: 14 }} />,
      label: t('argus.feedback.device'),
      value: selectedItem.device,
      field: 'device',
    },
    {
      icon: <UserIdIcon sx={{ fontSize: 14 }} />,
      label: t('argus.feedback.userId'),
      value: selectedItem.user_id,
      field: 'user_id',
    },
  ].filter((row) => row.value);

  // ─── Issue linking helpers ───
  const issueClr =
    selectedItem.issue_status === 'resolved'
      ? ARGUS_SEMANTIC.positive
      : selectedItem.issue_status === 'ignored'
        ? '#9e9e9e'
        : ARGUS_SEMANTIC.warning;

  const issueTextColor =
    selectedItem.issue_status === 'resolved'
      ? isDark
        ? '#66bb6a'
        : '#2e7d32'
      : selectedItem.issue_status === 'ignored'
        ? isDark
          ? '#bdbdbd'
          : '#616161'
        : isDark
          ? '#ffb74d'
          : '#e65100';

  return (
    <>
      <DetailContainer>
        {/* ─── Detail Header ─── */}
        <DetailHeader isDark={isDark}>
          <Avatar
            sx={{
              width: 36,
              height: 36,
              fontSize: '0.8rem',
              fontWeight: 700,
              backgroundColor: stringToColor(
                selectedItem.name || selectedItem.email || 'A'
              ),
            }}
          >
            {getInitials(
              selectedItem.name || selectedItem.email?.split('@')[0] || 'A'
            )}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="body1"
              fontWeight={700}
              sx={{ fontSize: '0.9rem' }}
            >
              {selectedItem.name ||
                selectedItem.email?.split('@')[0] ||
                t('argus.feedback.anonymous')}
            </Typography>
            {selectedItem.email && (
              <Typography
                variant="caption"
                sx={{
                  color: isDark ? '#888' : '#777',
                  fontSize: '0.72rem',
                }}
              >
                {selectedItem.email}
              </Typography>
            )}
          </Box>
          <StatusChip
            label={t(
              `argus.feedback.status${(selectedItem.status || 'unresolved').charAt(0).toUpperCase() + (selectedItem.status || 'unresolved').slice(1)}`,
              selectedItem.status
            )}
            size="small"
            statusColor={statusColor(selectedItem.status)}
          />
          <Typography
            variant="caption"
            sx={{ color: isDark ? '#666' : '#999', fontSize: '0.68rem' }}
          >
            {formatRelativeTime(selectedItem.submitted_at)}
          </Typography>
        </DetailHeader>

        {/* ─── Detail Actions — Unified Toolbar ─── */}
        <DetailToolbar isDark={isDark}>
          {/* Status action group */}
          <ToolbarButtonGroup isDark={isDark}>
            {selectedItem.status !== 'resolved' ? (
              <ToolbarButton
                size="small"
                isDark={isDark}
                accentColor={isDark ? '#66bb6a' : '#2e7d32'}
                startIcon={<ResolveIcon sx={{ fontSize: '14px !important' }} />}
                onClick={() =>
                  onUpdateStatus(selectedItem.feedback_id, 'resolved')
                }
              >
                {t('argus.feedback.resolve')}
              </ToolbarButton>
            ) : (
              <ToolbarButton
                size="small"
                isDark={isDark}
                accentColor={isDark ? '#ffb74d' : '#e65100'}
                startIcon={
                  <UnresolveIcon sx={{ fontSize: '14px !important' }} />
                }
                onClick={() =>
                  onUpdateStatus(selectedItem.feedback_id, 'unresolved')
                }
              >
                {t('argus.feedback.unresolve')}
              </ToolbarButton>
            )}
            {!selectedItem.is_spam && (
              <>
                <ToolbarDivider
                  orientation="vertical"
                  flexItem
                  isDark={isDark}
                />
                <ToolbarButton
                  size="small"
                  isDark={isDark}
                  accentColor={
                    isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'
                  }
                  isSubdued
                  startIcon={<SpamIcon sx={{ fontSize: '14px !important' }} />}
                  onClick={() => onMarkSpam(selectedItem.feedback_id)}
                >
                  {t('argus.feedback.markSpam')}
                </ToolbarButton>
              </>
            )}
            <ToolbarDivider orientation="vertical" flexItem isDark={isDark} />
            <ToolbarButton
              size="small"
              isDark={isDark}
              accentColor={isDark ? '#b388ff' : '#5e35b1'}
              isSubdued
              startIcon={<AssignIcon sx={{ fontSize: '14px !important' }} />}
              onClick={(e) =>
                setAssigneeAnchor({
                  el: e.currentTarget,
                  feedbackId: selectedItem.feedback_id,
                })
              }
            >
              {(() => {
                if (!selectedItem.assigned_to)
                  return t('argus.feedback.assign');
                const assignedIsMe =
                  user &&
                  (selectedItem.assigned_to === user.name ||
                    selectedItem.assigned_to === user.email);
                return assignedIsMe
                  ? t('argus.issues.assigneeMe', {
                      name: selectedItem.assigned_to,
                    })
                  : selectedItem.assigned_to;
              })()}
            </ToolbarButton>
          </ToolbarButtonGroup>

          <Box sx={{ flex: 1 }} />

          {/* Issue linking group */}
          {selectedItem.issue_id ? (
            <ToolbarButtonGroup isDark={isDark}>
              <ToolbarButton
                size="small"
                isDark={isDark}
                accentColor={issueTextColor}
                startIcon={
                  <BugReportIcon sx={{ fontSize: '14px !important' }} />
                }
                onClick={() => navigateToIssue(selectedItem.issue_id!)}
              >
                #{selectedItem.issue_id} {selectedItem.issue_status || ''}
              </ToolbarButton>
            </ToolbarButtonGroup>
          ) : (
            <ToolbarButtonGroup isDark={isDark}>
              <ToolbarButton
                size="small"
                isDark={isDark}
                accentColor={isDark ? '#64b5f6' : '#1565c0'}
                isSubdued
                startIcon={<LinkIcon sx={{ fontSize: '14px !important' }} />}
                onClick={onOpenLinkIssue}
              >
                {t('argus.feedback.linkExistingIssue')}
              </ToolbarButton>
              <ToolbarDivider orientation="vertical" flexItem isDark={isDark} />
              <ToolbarButton
                size="small"
                isDark={isDark}
                accentColor={isDark ? '#7986cb' : '#283593'}
                isSubdued
                startIcon={<AddIcon sx={{ fontSize: '14px !important' }} />}
                onClick={onOpenCreateIssue}
              >
                {t('argus.feedback.createIssue')}
              </ToolbarButton>
            </ToolbarButtonGroup>
          )}
        </DetailToolbar>

        {/* ─── Detail Body ─── */}
        <DetailBody>
          {/* Message */}
          <MessagePaper elevation={0} isDark={isDark}>
            <Typography
              variant="body2"
              sx={{
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                lineHeight: 1.8,
                fontSize: '0.88rem',
              }}
            >
              {selectedItem.message}
            </Typography>
          </MessagePaper>

          {/* Linked Issue Card */}
          {selectedItem.issue_id && (
            <LinkedIssuePaper elevation={0} isDark={isDark}>
              <LinkedIssueHeaderBar isDark={isDark}>
                <BugReportIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                <Typography
                  variant="caption"
                  fontWeight={700}
                  sx={{
                    fontSize: '0.7rem',
                    color: 'text.secondary',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  {t('argus.feedback.linkedIssue', 'Linked Issue')}
                </Typography>
              </LinkedIssueHeaderBar>
              <Box sx={{ px: 2, py: 1.5 }}>
                {/* Issue title + status */}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 1,
                    mb: 1,
                  }}
                >
                  <IssueStatusChip
                    label={selectedItem.issue_status || 'unresolved'}
                    size="small"
                    statusColor={issueClr}
                  />
                  <Typography
                    variant="body2"
                    sx={{
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      lineHeight: 1.4,
                      '&:hover': { textDecoration: 'underline' },
                    }}
                    onClick={() => navigateToIssue(selectedItem.issue_id!)}
                  >
                    {selectedItem.issue_title ||
                      `Issue #${selectedItem.issue_id}`}
                  </Typography>
                </Box>

                {/* Issue meta */}
                <Box
                  sx={{
                    display: 'flex',
                    gap: 2,
                    mb: 1.5,
                    flexWrap: 'wrap',
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{ fontSize: '0.68rem', color: 'text.disabled' }}
                  >
                    #{selectedItem.issue_id}
                  </Typography>
                  {linkedIssueDetail && (
                    <>
                      <Typography
                        variant="caption"
                        sx={{ fontSize: '0.68rem', color: 'text.disabled' }}
                      >
                        {t('argus.issues.events', 'Events')}:{' '}
                        {formatWithCommas(linkedIssueDetail.event_count)}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ fontSize: '0.68rem', color: 'text.disabled' }}
                      >
                        {t('argus.issues.users', 'Users')}:{' '}
                        {formatWithCommas(linkedIssueDetail.user_count)}
                      </Typography>
                    </>
                  )}
                </Box>

                {/* Actions */}
                <Box sx={{ display: 'flex', gap: 0.75 }}>
                  <CardActionButton
                    size="small"
                    isDark={isDark}
                    accentColor={ARGUS_SEMANTIC.info}
                    startIcon={
                      <OpenIcon sx={{ fontSize: '14px !important' }} />
                    }
                    onClick={() => navigateToIssue(selectedItem.issue_id!)}
                  >
                    {t('argus.feedback.viewIssue')}
                  </CardActionButton>
                  <CardActionButton
                    size="small"
                    isDark={isDark}
                    accentColor={ARGUS_SEMANTIC.negative}
                    onClick={onUnlinkIssue}
                  >
                    {t('argus.feedback.unlinkIssue')}
                  </CardActionButton>
                </Box>
              </Box>
            </LinkedIssuePaper>
          )}

          {/* Attachments */}
          {selectedItem.attachments?.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography
                variant="caption"
                fontWeight={600}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  mb: 1,
                  fontSize: '0.72rem',
                  color: 'text.secondary',
                }}
              >
                <ImageIcon sx={{ fontSize: 14 }} />{' '}
                {t('argus.feedback.attachments')} (
                {selectedItem.attachments.length})
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {selectedItem.attachments.map((url, ai) => (
                  <AttachmentThumbnail
                    key={ai}
                    isDark={isDark}
                    onClick={() => setLightboxUrl(url)}
                  >
                    <img
                      src={url}
                      alt={`attachment-${ai}`}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                  </AttachmentThumbnail>
                ))}
              </Box>
            </Box>
          )}

          {/* Metadata Section */}
          {metadataRows.length > 0 && (
            <>
              <SectionTitle
                variant="caption"
                fontWeight={600}
                color="text.secondary"
              >
                {t('argus.feedback.metadata')}
              </SectionTitle>
              <MetadataPaper elevation={0} isDark={isDark}>
                {metadataRows.map((row, idx) => (
                  <MetadataRow
                    key={idx}
                    isDark={isDark}
                    sx={{
                      '&:hover .filter-actions': { opacity: 1 },
                    }}
                  >
                    <Box
                      sx={{
                        color: isDark ? '#666' : '#aaa',
                        display: 'flex',
                      }}
                    >
                      {row.icon}
                    </Box>
                    <Typography
                      variant="caption"
                      sx={{
                        fontWeight: 600,
                        color: 'text.secondary',
                        fontSize: '0.7rem',
                        minWidth: 80,
                      }}
                    >
                      {row.label}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        fontSize: '0.72rem',
                        wordBreak: 'break-all',
                        flex: 1,
                      }}
                    >
                      {row.value}
                    </Typography>
                    {onAddFilter && row.field && (
                      <Box
                        className="filter-actions"
                        sx={{
                          display: 'flex',
                          gap: 0.25,
                          opacity: 0,
                          transition: 'opacity 0.15s',
                          ml: 0.5,
                        }}
                      >
                        <IconButton
                          size="small"
                          title={t(
                            'argus.feedback.addToFilter',
                            'Add to filter'
                          )}
                          onClick={() =>
                            onAddFilter(
                              row.field!,
                              (row as any).rawValue || (row.value as string)
                            )
                          }
                          sx={{
                            p: 0.25,
                            color: isDark ? '#6b9' : '#2e7d32',
                            '&:hover': {
                              backgroundColor: isDark
                                ? 'rgba(102,187,106,0.12)'
                                : 'rgba(46,125,50,0.08)',
                            },
                          }}
                        >
                          <FilterAddIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                        <IconButton
                          size="small"
                          title={t(
                            'argus.feedback.excludeFromFilter',
                            'Exclude from filter'
                          )}
                          onClick={() =>
                            onAddFilter(
                              row.field!,
                              (row as any).rawValue || (row.value as string),
                              true
                            )
                          }
                          sx={{
                            p: 0.25,
                            color: isDark ? '#e57' : '#c62828',
                            '&:hover': {
                              backgroundColor: isDark
                                ? 'rgba(229,87,119,0.12)'
                                : 'rgba(198,40,40,0.08)',
                            },
                          }}
                        >
                          <FilterExcludeIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Box>
                    )}
                    <CopyButton text={row.value as string} size={14} />
                  </MetadataRow>
                ))}
              </MetadataPaper>
            </>
          )}

          {/* Tags */}
          {selectedItem.tags && Object.keys(selectedItem.tags).length > 0 && (
            <>
              <SectionTitle
                variant="caption"
                fontWeight={600}
                color="text.secondary"
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                }}
              >
                <TagIcon sx={{ fontSize: 14 }} /> {t('argus.feedback.tags')}
              </SectionTitle>
              <Box
                sx={{
                  display: 'flex',
                  gap: 0.5,
                  flexWrap: 'wrap',
                  mb: 2,
                }}
              >
                {Object.entries(selectedItem.tags).map(([k, v]) => (
                  <TagChip
                    key={k}
                    label={`${k}: ${v}`}
                    size="small"
                    onClick={
                      onAddFilter
                        ? () => onAddFilter(k, v as string)
                        : undefined
                    }
                    sx={
                      onAddFilter
                        ? {
                            cursor: 'pointer',
                            '&:hover': {
                              boxShadow: isDark
                                ? '0 0 0 1px rgba(255,255,255,0.2)'
                                : '0 0 0 1px rgba(0,0,0,0.15)',
                            },
                          }
                        : undefined
                    }
                  />
                ))}
              </Box>
            </>
          )}

          {/* Activity Timeline */}
          <FeedbackActivityTimeline
            projectId={projectId}
            feedbackId={selectedItem.feedback_id}
            isDark={isDark}
          />
        </DetailBody>
      </DetailContainer>

      {/* ─── Assignee Menu ─── */}
      <Menu
        anchorEl={assigneeAnchor?.el}
        open={Boolean(assigneeAnchor)}
        onClose={() => setAssigneeAnchor(null)}
        slotProps={{
          paper: {
            sx: {
              borderRadius: 2,
              minWidth: 160,
              maxHeight: 300,
              boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
            },
          },
        }}
      >
        <MenuItem onClick={() => handleAssign('')}>
          <ListItemIcon>
            <PersonIcon sx={{ fontSize: 18 }} />
          </ListItemIcon>
          <ListItemText
            primary={t('argus.issues.unassigned')}
            primaryTypographyProps={{ fontSize: '0.82rem' }}
          />
        </MenuItem>
        <Divider />
        {members.map((member) => {
          const dn = member.name || member.email || member.userId;
          const memberIsMe =
            user &&
            (member.email === user.email ||
              member.name === user.name ||
              member.userId === String(user.id));
          const label = memberIsMe
            ? t('argus.issues.assigneeMe', { name: dn })
            : dn;
          return (
            <MenuItem key={member.userId} onClick={() => handleAssign(dn)}>
              <Avatar
                sx={{
                  width: 20,
                  height: 20,
                  mr: 1,
                  fontSize: '0.55rem',
                  fontWeight: 700,
                  backgroundColor: stringToColor(dn),
                }}
              >
                {getInitials(dn)}
              </Avatar>
              <ListItemText
                primary={label}
                primaryTypographyProps={{
                  fontSize: '0.82rem',
                  fontWeight: memberIsMe ? 700 : 400,
                }}
              />
            </MenuItem>
          );
        })}
      </Menu>

      {/* ─── Lightbox ─── */}
      <Dialog
        open={Boolean(lightboxUrl)}
        onClose={() => setLightboxUrl(null)}
        maxWidth="lg"
      >
        <DialogContent sx={{ p: 0, position: 'relative' }}>
          <IconButton
            onClick={() => setLightboxUrl(null)}
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              backgroundColor: 'rgba(0,0,0,0.5)',
              color: '#fff',
              '&:hover': { backgroundColor: 'rgba(0,0,0,0.7)' },
            }}
          >
            <CloseIcon />
          </IconButton>
          {lightboxUrl && (
            <img
              src={lightboxUrl}
              alt="attachment"
              style={{ maxWidth: '90vw', maxHeight: '80vh', display: 'block' }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default React.memo(FeedbackDetailPanel);
