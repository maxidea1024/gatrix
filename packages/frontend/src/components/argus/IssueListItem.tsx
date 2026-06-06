import React from 'react';
import {
  Box,
  Typography,
  Checkbox,
  Chip,
  Tooltip,
  Avatar,
  IconButton,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Schedule as ScheduleIcon,
  PersonAdd as AssignIcon,
  OpenInNew as ExternalLinkIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { ArgusIssue } from '@/services/argusService';
import {
  LEVEL_CONFIG,
  PRIORITY_CONFIG,
  stringToColor,
  getInitials,
  formatRelative,
} from '@/utils/argusHelpers';
import HighlightText from '@/components/common/HighlightText';
import ArgusSparkline from '@/components/argus/ArgusSparkline';
import { formatCompactNumber } from '@/utils/numberFormat';

export interface IssueListItemProps {
  /** The issue to render */
  issue: ArgusIssue;
  /** Called when the row is clicked */
  onClick?: (issue: ArgusIssue) => void;
  /** Search term to highlight in the title */
  highlight?: string;
  /** Whether to show the selection checkbox */
  showCheckbox?: boolean;
  /** Whether the checkbox is checked */
  checked?: boolean;
  /** Callback when checkbox changes */
  onCheckChange?: (id: number) => void;
  /** Whether to show the assignee avatar / assign button */
  showAssignee?: boolean;
  /** Callback when the assignee area is clicked */
  onAssigneeClick?: (
    e: React.MouseEvent<HTMLElement>,
    issue: ArgusIssue
  ) => void;
  /** Whether to show the 24h sparkline */
  showSparkline?: boolean;
  /** Whether to show last_seen timestamp */
  showLastSeen?: boolean;
  /** Compact mode — fewer columns, suited for sidebar widgets */
  compact?: boolean;
  /** For border-radius on the first item's level bar */
  isFirst?: boolean;
  /** For border-radius on the last item's level bar */
  isLast?: boolean;
  /** Whether to show divider border at the bottom */
  showDivider?: boolean;
}

/**
 * A single issue row used across issue lists (IssuesPage, ReleaseDetailPage, etc.)
 * Ensures consistent look-and-feel for issue items project-wide.
 */
const IssueListItem: React.FC<IssueListItemProps> = ({
  issue,
  onClick,
  highlight = '',
  showCheckbox = false,
  checked = false,
  onCheckChange,
  showAssignee = false,
  onAssigneeClick,
  showSparkline = true,
  showLastSeen = true,
  compact = false,
  isFirst = false,
  isLast = false,
  showDivider = true,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';
  const lc = LEVEL_CONFIG[issue.level] || LEVEL_CONFIG.info;

  const handleClick = () => onClick?.(issue);

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    onCheckChange?.(issue.id);
  };

  // ─── Compact mode (overview widget, sidebar) ───────────────────
  if (compact) {
    return (
      <Box
        onClick={handleClick}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          p: 1,
          pl: 0,
          borderRadius: 1.5,
          cursor: onClick ? 'pointer' : 'default',
          transition: 'background 0.15s',
          '&:hover': onClick ? { backgroundColor: alpha(lc.color, 0.06) } : {},
        }}
      >
        <Box
          sx={{
            width: 3,
            height: 32,
            borderRadius: 1,
            backgroundColor: lc.color,
            flexShrink: 0,
          }}
        />
        <Box sx={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
          <Typography
            variant="body2"
            fontWeight={600}
            noWrap
            sx={{ lineHeight: 1.3 }}
          >
            {highlight ? (
              <HighlightText text={issue.title} highlight={highlight} />
            ) : (
              issue.title
            )}
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            noWrap
            sx={{ fontSize: '0.7rem' }}
          >
            {issue.culprit || issue.fingerprint?.slice(0, 16)}
          </Typography>
        </Box>
        <Box
          sx={{
            px: 1.2,
            py: 0.3,
            borderRadius: 1,
            backgroundColor: alpha(lc.color, isDark ? 0.15 : 0.08),
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            flexShrink: 0,
          }}
        >
          <Typography
            variant="caption"
            fontWeight={700}
            sx={{ color: lc.color, fontSize: '0.72rem' }}
          >
            {formatCompactNumber(issue.event_count || 0)}
          </Typography>
        </Box>
      </Box>
    );
  }

  // ─── Full mode (main issues page) ─────────────────────────────
  return (
    <Box
      onClick={handleClick}
      sx={{
        display: 'flex',
        alignItems: 'stretch',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'background 0.15s',
        borderBottom: showDivider
          ? `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`
          : 'none',
        '&:hover': onClick
          ? {
              backgroundColor: isDark
                ? 'rgba(255,255,255,0.02)'
                : 'rgba(0,0,0,0.015)',
            }
          : {},
      }}
    >
      {/* Level color bar */}
      <Box
        sx={{
          width: 4,
          flexShrink: 0,
          backgroundColor: lc.color,
          borderRadius: isFirst ? '8px 0 0 0' : isLast ? '0 0 0 8px' : 0,
        }}
      />

      {/* Checkbox */}
      {showCheckbox && (
        <Box sx={{ display: 'flex', alignItems: 'center', pl: 0.5 }}>
          <Checkbox
            size="small"
            checked={checked}
            onChange={handleCheckboxChange}
            onClick={(e) => e.stopPropagation()}
            sx={{ p: 0.3, '& .MuiSvgIcon-root': { fontSize: 16 } }}
          />
        </Box>
      )}

      {/* Main content */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          px: 1.5,
          py: 1.5,
          gap: 2,
          minWidth: 0,
        }}
      >
        {/* Level icon badge */}
        <Box
          sx={{
            width: 30,
            height: 30,
            borderRadius: 1.5,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: lc.bg,
            color: lc.color,
          }}
        >
          {lc.icon}
        </Box>

        {/* Title + culprit */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.2 }}>
            <Typography
              variant="body2"
              fontWeight={600}
              noWrap
              sx={{ color: isDark ? '#e0e0e0' : '#1a1a2e', lineHeight: 1.3 }}
            >
              {highlight ? (
                <HighlightText
                  text={issue.title}
                  highlight={highlight}
                  isDark={isDark}
                />
              ) : (
                issue.title
              )}
            </Typography>
            {issue.external_url && (
              <Tooltip
                title={`${issue.external_key || 'External'} — ${t('argus.issues.openExternal')}`}
              >
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(issue.external_url!, '_blank');
                  }}
                  sx={{ p: 0.2, '&:hover': { color: '#0052CC' } }}
                >
                  <ExternalLinkIcon sx={{ fontSize: 13 }} />
                </IconButton>
              </Tooltip>
            )}
            {issue.substatus === 'regressed' && (
              <Chip
                label={t('argus.issues.regression')}
                size="small"
                sx={{
                  height: 18,
                  fontSize: '0.6rem',
                  fontWeight: 700,
                  backgroundColor: alpha('#ff9800', 0.15),
                  color: '#ff9800',
                  border: 'none',
                }}
              />
            )}
            {issue.substatus === 'escalating' && (
              <Chip
                label={t('argus.issues.escalating')}
                size="small"
                sx={{
                  height: 18,
                  fontSize: '0.6rem',
                  fontWeight: 700,
                  backgroundColor: alpha('#f44336', 0.15),
                  color: '#f44336',
                  border: 'none',
                }}
              />
            )}
            {issue.priority && PRIORITY_CONFIG[issue.priority] && (
              <Chip
                icon={PRIORITY_CONFIG[issue.priority].icon}
                label={t(
                  `argus.issues.priority.${issue.priority}`,
                  PRIORITY_CONFIG[issue.priority].label
                )}
                size="small"
                sx={{
                  height: 18,
                  fontSize: '0.6rem',
                  fontWeight: 600,
                  backgroundColor: alpha(
                    PRIORITY_CONFIG[issue.priority].color,
                    0.1
                  ),
                  color: PRIORITY_CONFIG[issue.priority].color,
                  border: 'none',
                  '& .MuiChip-icon': { color: 'inherit', ml: 0.5 },
                }}
              />
            )}
          </Box>
          <Typography
            variant="caption"
            noWrap
            sx={{
              color: isDark ? '#666' : '#999',
              fontSize: '0.75rem',
              display: 'block',
            }}
          >
            {issue.culprit || issue.fingerprint?.slice(0, 16)}
          </Typography>
        </Box>

        {/* Stats area */}
        <Box
          sx={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}
        >
          {/* 24h Sparkline */}
          {showSparkline && issue.stats_24h && issue.stats_24h.length > 0 && (
            <ArgusSparkline
              data={issue.stats_24h}
              width={48}
              height={20}
              color={lc.color}
              strokeWidth={1.5}
              showDot={false}
            />
          )}

          {/* Event count */}
          <Box sx={{ textAlign: 'center', minWidth: 50 }}>
            <Typography
              variant="body2"
              fontWeight={700}
              sx={{ lineHeight: 1.2 }}
            >
              {formatCompactNumber(issue.event_count || 0)}
            </Typography>
            <Typography
              variant="caption"
              sx={{ fontSize: '0.65rem', color: isDark ? '#555' : '#aaa' }}
            >
              {t('argus.issues.events')}
            </Typography>
          </Box>

          {/* User count */}
          <Box sx={{ textAlign: 'center', minWidth: 40 }}>
            <Typography
              variant="body2"
              fontWeight={700}
              sx={{ lineHeight: 1.2 }}
            >
              {formatCompactNumber(issue.user_count || 0)}
            </Typography>
            <Typography
              variant="caption"
              sx={{ fontSize: '0.65rem', color: isDark ? '#555' : '#aaa' }}
            >
              {t('argus.issues.users')}
            </Typography>
          </Box>

          {/* Assignee */}
          {showAssignee && (
            <Box
              sx={{ minWidth: 28, display: 'flex', justifyContent: 'center' }}
            >
              {issue.assigned_to ? (
                <Tooltip
                  title={`${t('argus.issues.assignedTo')}: ${issue.assigned_to}`}
                >
                  <Avatar
                    onClick={(e) => {
                      e.stopPropagation();
                      onAssigneeClick?.(e, issue);
                    }}
                    sx={{
                      width: 22,
                      height: 22,
                      fontSize: '0.55rem',
                      fontWeight: 700,
                      backgroundColor: stringToColor(issue.assigned_to),
                      cursor: 'pointer',
                    }}
                  >
                    {getInitials(issue.assigned_to)}
                  </Avatar>
                </Tooltip>
              ) : (
                <Tooltip title={t('argus.issues.unassigned')}>
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAssigneeClick?.(e, issue);
                    }}
                    sx={{ p: 0.3 }}
                  >
                    <AssignIcon
                      sx={{ fontSize: 16, color: isDark ? '#444' : '#ccc' }}
                    />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          )}

          {/* Last seen */}
          {showLastSeen && (
            <Box sx={{ minWidth: 70, textAlign: 'right' }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.3,
                  justifyContent: 'flex-end',
                }}
              >
                <ScheduleIcon
                  sx={{ fontSize: 12, color: isDark ? '#555' : '#aaa' }}
                />
                <Typography
                  variant="caption"
                  sx={{ fontSize: '0.72rem', color: isDark ? '#777' : '#888' }}
                >
                  {issue.last_seen ? formatRelative(issue.last_seen, t) : '-'}
                </Typography>
              </Box>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default React.memo(IssueListItem);
