import React, { useState } from 'react';
import {
  Box,
  Typography,
  Chip,
  Divider,
  useTheme,
  alpha,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  ErrorOutline as ErrorIcon,
  CheckCircle as CheckCircleIcon,
  DoNotDisturb as IgnoreIcon,
  ExpandMore as ExpandMoreIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { ArgusIssueDetail, ArgusErrorEvent } from '@/services/argusService';
import { formatCompactNumber } from '@/utils/numberFormat';
import { LEVEL_COLORS, PRIORITY_CONFIG } from '@/utils/argusHelpers';
import { CopyButton } from '@/components/common/CopyButton';
import ArgusBreadcrumbs from '@/components/argus/ArgusBreadcrumbs';
import PresenceIndicator from '@/components/argus/PresenceIndicator';
import IssueDetailActions from '@/components/argus/IssueDetailActions';
import PageHeader from '@/components/common/PageHeader';

export interface IssueActionBarProps {
  issue: ArgusIssueDetail;
  latestEvent: ArgusErrorEvent | null;
  projectId: string;
  issueId: string;
  isDark: boolean;
  /** Callbacks */
  onStatusChange: (status: string) => Promise<void>;
  onPriorityChange: (priority: string) => Promise<void>;
  onAssigneeClick: (e: React.MouseEvent<HTMLElement>) => void;
  onAiAnalysis: () => void;
  onBack?: () => void;
  /** Subscription / Bookmark */
  isSubscribed: boolean;
  isBookmarked: boolean;
  onSubscribe: (sub: boolean) => Promise<void>;
  onBookmark: (bm: boolean) => Promise<void>;
  onDelete: () => Promise<void>;
  onDiscard: () => Promise<void>;
  /** Sidebar toggle */
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}

const IssueActionBar: React.FC<IssueActionBarProps> = ({
  issue,
  latestEvent,
  projectId,
  issueId,
  isDark,
  onStatusChange,
  onPriorityChange,
  onAssigneeClick,
  onAiAnalysis,
  onBack,
  isSubscribed,
  isBookmarked,
  onSubscribe,
  onBookmark,
  onDelete,
  onDiscard,
  sidebarCollapsed,
  onToggleSidebar,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();

  const [statusMenuAnchor, setStatusMenuAnchor] = useState<null | HTMLElement>(null);
  const [priorityAnchor, setPriorityAnchor] = useState<null | HTMLElement>(null);

  const levelColor = LEVEL_COLORS[issue.level || 'error'] || LEVEL_COLORS.error;

  const handleStatusRequest = (status: string) => {
    onStatusChange(status);
    setStatusMenuAnchor(null);
  };

  const handlePrioritySelect = (priority: string) => {
    onPriorityChange(priority);
    setPriorityAnchor(null);
  };

  return (
    <>
      {/* Header */}
      <PageHeader
        icon={<Box sx={{ width: 4, height: 18, borderRadius: 1, backgroundColor: levelColor, ml: 1 }} />}
        title={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ArgusBreadcrumbs
              paths={[
                { label: t('sidebar.argusIssues', 'Issues'), to: `/argus/issues` },
                { label: issue.title }
              ]}
              size="title"
            />
            <Chip
              label={issue.level}
              size="small"
              sx={{
                fontWeight: 700, fontSize: '0.65rem', height: 18,
                backgroundColor: alpha(levelColor, 0.12),
                color: levelColor, border: 'none',
              }}
            />
          </Box>
        }
        subtitle={issue.culprit}
        enableAutoBack={false}
        onBack={onBack}
        actions={
          <Box sx={{ display: 'flex', gap: 3, pt: 0.5, pr: 1, alignItems: 'center' }}>
            <Box sx={{ display: 'flex', gap: 3 }}>
              <Box sx={{ textAlign: 'center' }}>
                <Tooltip title={issue.event_count >= 1000 ? issue.event_count.toLocaleString() : ''} arrow placement="top">
                  <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1, fontSize: '1.2rem', cursor: issue.event_count >= 1000 ? 'help' : 'default' }}>
                    {formatCompactNumber(issue.event_count || 0)}
                  </Typography>
                </Tooltip>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>
                  {t('argus.issues.events')}
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'center' }}>
                <Tooltip title={issue.user_count >= 1000 ? issue.user_count.toLocaleString() : ''} arrow placement="top">
                  <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1, fontSize: '1.2rem', cursor: issue.user_count >= 1000 ? 'help' : 'default' }}>
                    {formatCompactNumber(issue.user_count || 0)}
                  </Typography>
                </Tooltip>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>
                  {t('argus.issues.users')}
                </Typography>
              </Box>
            </Box>
          </Box>
        }
      />

      {/* Action Bar */}
      <Box
        sx={{
          py: 1, mb: 2, display: 'flex', gap: 0.8, alignItems: 'center', flexWrap: 'wrap',
          borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        }}
      >
        {/* Status Badge */}
        <Chip
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography component="span" sx={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                {t(`argus.issues.${issue.status}`, issue.status)}
              </Typography>
              {issue.substatus === 'regressed' && (
                <Typography component="span" sx={{ fontSize: '0.62rem', fontWeight: 600, color: '#ff9800' }}>
                  {t('argus.issues.regressed', 'Regressed')}
                </Typography>
              )}
              {issue.is_regression && (
                <Typography component="span" sx={{ fontSize: '0.62rem', fontWeight: 600, color: '#ff9800' }}>
                  {t('argus.issues.regression')}
                </Typography>
              )}
            </Box>
          }
          size="small"
          sx={{
            height: 28, borderRadius: '6px',
            border: `1px solid ${alpha(issue.status === 'resolved' ? '#4caf50' : issue.status === 'ignored' ? '#9e9e9e' : '#f44336', 0.3)}`,
            backgroundColor: alpha(issue.status === 'resolved' ? '#4caf50' : issue.status === 'ignored' ? '#9e9e9e' : '#f44336', 0.12),
            color: issue.status === 'resolved' ? '#4caf50' : issue.status === 'ignored' ? '#9e9e9e' : '#f44336',
            '& .MuiChip-label': { px: 1.2 },
          }}
        />

        {/* Status Change — split button */}
        <Box sx={{
          display: 'flex', alignItems: 'center', height: 28,
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'}`,
          borderRadius: '6px', overflow: 'hidden',
        }}>
          <Chip
            icon={issue.status === 'resolved' ? <ErrorIcon sx={{ fontSize: '14px !important' }} /> : <CheckCircleIcon sx={{ fontSize: '14px !important' }} />}
            label={issue.status === 'resolved' ? t('argus.issues.reopen') : t('argus.issues.resolve')}
            size="small"
            onClick={() => handleStatusRequest(issue.status === 'resolved' ? 'unresolved' : 'resolved')}
            sx={{
              height: '100%', borderRadius: 0, border: 'none',
              backgroundColor: 'transparent',
              color: 'text.primary', fontWeight: 600, fontSize: '0.75rem',
              '& .MuiChip-icon': { color: 'inherit', ml: 0.8 },
              '& .MuiChip-label': { px: 0.8 },
              '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' },
            }}
          />
          <Divider orientation="vertical" flexItem />
          <Chip
            icon={<ExpandMoreIcon sx={{ fontSize: '16px !important' }} />}
            size="small"
            onClick={(e) => setStatusMenuAnchor(e.currentTarget)}
            sx={{
              height: '100%', borderRadius: 0, border: 'none', minWidth: 28,
              backgroundColor: 'transparent',
              color: 'text.secondary',
              '& .MuiChip-icon': { color: 'inherit', ml: 0.5, mr: -0.5 },
              '& .MuiChip-label': { display: 'none' },
              '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' },
            }}
          />
        </Box>

          <Menu
            anchorEl={statusMenuAnchor}
            open={Boolean(statusMenuAnchor)}
            onClose={() => setStatusMenuAnchor(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            sx={{ '& .MuiPaper-root': { minWidth: 150, mt: 0.5, borderRadius: 2, border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, backgroundImage: 'none', backgroundColor: isDark ? '#222' : '#fff' } }}
          >
            {issue.status !== 'resolved' && (
              <MenuItem onClick={() => handleStatusRequest('resolved')} sx={{ fontSize: '0.8rem', py: 1 }}>
                <ListItemIcon><CheckCircleIcon fontSize="small" color="success" /></ListItemIcon>
                <ListItemText primary={t('argus.issues.resolve')} primaryTypographyProps={{ fontSize: '0.8rem', fontWeight: 500 }} />
              </MenuItem>
            )}
            {issue.status !== 'resolved' && latestEvent?.release && (
              <MenuItem onClick={() => handleStatusRequest('resolved')} sx={{ fontSize: '0.8rem', py: 1, pl: 4 }}>
                <ListItemText
                  primary={t('argus.detail.resolveInCurrentRelease')}
                  secondary={latestEvent.release}
                  primaryTypographyProps={{ fontSize: '0.75rem', fontWeight: 500 }}
                  secondaryTypographyProps={{ fontSize: '0.65rem' }}
                />
              </MenuItem>
            )}
            {issue.status !== 'resolved' && (
              <MenuItem onClick={() => handleStatusRequest('resolved')} sx={{ fontSize: '0.8rem', py: 1, pl: 4 }}>
                <ListItemText
                  primary={t('argus.detail.resolveInNextRelease')}
                  primaryTypographyProps={{ fontSize: '0.75rem', fontWeight: 500 }}
                />
              </MenuItem>
            )}
            <Divider sx={{ my: 0.5 }} />
            {issue.status !== 'ignored' && (
              <MenuItem onClick={() => handleStatusRequest('ignored')} sx={{ fontSize: '0.8rem', py: 1 }}>
                <ListItemIcon><IgnoreIcon fontSize="small" color="action" /></ListItemIcon>
                <ListItemText primary={t('argus.issues.ignore')} primaryTypographyProps={{ fontSize: '0.8rem', fontWeight: 500 }} />
              </MenuItem>
            )}
            {issue.status !== 'archived' && (
              <MenuItem onClick={() => handleStatusRequest('archived')} sx={{ fontSize: '0.8rem', py: 1 }}>
                <ListItemIcon><IgnoreIcon fontSize="small" sx={{ color: 'text.disabled' }} /></ListItemIcon>
                <ListItemText primary={t('argus.detail.archive')} primaryTypographyProps={{ fontSize: '0.8rem', fontWeight: 500 }} />
              </MenuItem>
            )}
            <Divider sx={{ my: 0.5 }} />
            {issue.status !== 'unresolved' && (
              <MenuItem onClick={() => handleStatusRequest('unresolved')} sx={{ fontSize: '0.8rem', py: 1 }}>
                <ListItemIcon><ErrorIcon fontSize="small" color="error" /></ListItemIcon>
                <ListItemText primary={t('argus.issues.reopen')} primaryTypographyProps={{ fontSize: '0.8rem', fontWeight: 500 }} />
              </MenuItem>
            )}
          </Menu>

        {/* Priority & Assignee */}
        <Chip
          icon={<Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: PRIORITY_CONFIG[issue.priority || 'medium']?.color || '#ff9800' }} />}
          label={PRIORITY_CONFIG[issue.priority || 'medium']?.label || t('argus.issues.priority.medium')}
          size="small"
          variant="outlined"
          onClick={(e) => setPriorityAnchor(e.currentTarget)}
          sx={{
            height: 28, borderRadius: '6px',
            borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
            color: 'text.primary', fontWeight: 600, fontSize: '0.75rem',
            '& .MuiChip-icon': { ml: 0.8 },
            '& .MuiChip-label': { px: 0.8 },
            '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' },
          }}
        />

        <Chip
          icon={<PersonIcon sx={{ fontSize: '14px !important', color: issue.assigned_to ? 'primary.main' : 'text.disabled' }} />}
          label={issue.assigned_to ? issue.assigned_to : t('argus.issues.unassigned', 'Unassigned')}
          size="small"
          variant="outlined"
          onClick={onAssigneeClick}
          sx={{
            height: 28, borderRadius: '6px',
            borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
            color: 'text.primary', fontWeight: 600, fontSize: '0.75rem',
            '& .MuiChip-icon': { ml: 0.8 },
            '& .MuiChip-label': { px: 0.8 },
            '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' },
          }}
        />

        <Menu
          anchorEl={priorityAnchor}
          open={Boolean(priorityAnchor)}
          onClose={() => setPriorityAnchor(null)}
          slotProps={{ paper: { sx: { borderRadius: 2, minWidth: 140, boxShadow: '0 4px 20px rgba(0,0,0,0.12)' } } }}
        >
          {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
            <MenuItem key={key} selected={issue.priority === key} onClick={() => handlePrioritySelect(key)} sx={{ fontSize: '0.82rem' }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: cfg.color, mr: 1 }} />
              {cfg.label}
            </MenuItem>
          ))}
        </Menu>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.3 }} />

        {/* AI Analysis */}
        <Chip
          label={t('argus.issues.aiAnalysis', 'AI 분석')}
          size="small"
          variant="outlined"
          onClick={onAiAnalysis}
          sx={{
            height: 28, borderRadius: '6px',
            borderColor: alpha(theme.palette.primary.main, 0.4),
            color: 'primary.main', fontWeight: 700, fontSize: '0.75rem',
            '& .MuiChip-label': { px: 1.2 },
            '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.08) },
          }}
        />

        {/* Right side items */}
        <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}>
          {projectId && issueId && (
            <PresenceIndicator
              projectId={projectId}
              resourceId={issueId}
              resourceType="issue"
              currentUser={{ id: 'current-user', name: 'You' }}
              isDark={isDark}
            />
          )}
          <Divider orientation="vertical" flexItem sx={{ mx: 0.3 }} />
          {issue.fingerprint && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Chip
                label={`FP: ${issue.fingerprint.slice(0, 8)}`}
                size="small"
                sx={{
                  cursor: 'default', height: 22, fontSize: '0.68rem',
                  backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                  border: 'none',
                }}
              />
              <CopyButton text={issue.fingerprint} size={12} />
            </Box>
          )}
          {latestEvent?.event_id && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Chip
                label={`ID: ${latestEvent.event_id.slice(0, 8)}`}
                size="small"
                sx={{
                  cursor: 'default', height: 22, fontSize: '0.68rem',
                  backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                  border: 'none',
                }}
              />
              <CopyButton text={latestEvent.event_id} size={12} />
            </Box>
          )}
          <IssueDetailActions
            projectId={projectId}
            issueId={issueId}
            shortId={issue.short_id}
            isSubscribed={isSubscribed}
            isBookmarked={isBookmarked}
            onSubscribe={onSubscribe}
            onBookmark={onBookmark}
            onDelete={onDelete}
            onDiscard={onDiscard}
            isDark={isDark}
            sidebarCollapsed={sidebarCollapsed}
            onToggleSidebar={onToggleSidebar}
          />
        </Box>
      </Box>
    </>
  );
};

export default React.memo(IssueActionBar);
