import React from 'react';
import {
  TableRow,
  TableCell,
  Tooltip,
  IconButton,
  Box,
  Typography,
  Chip,
  alpha,
  useTheme,
} from '@mui/material';
import {
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  EmojiEvents as WhaleIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import type { ArgusUserProfile } from '@/services/argus/argusTypes';
import ArgusSparkline from '@/components/argus/ArgusSparkline';
import CohortChip, { type CohortMembership } from '@/components/argus/CohortChip';
import { formatRelativeTime } from '@/utils/dateFormat';

const CHURN_CONFIG: Record<
  string,
  { labelKey: string; descKey: string; color: string; bg: string }
> = {
  none: {
    labelKey: 'argus.userProfiles.churnNone',
    descKey: 'argus.userProfiles.churnNoneDesc',
    color: '#4caf50',
    bg: 'rgba(76,175,80,0.12)',
  },
  low: {
    labelKey: 'argus.userProfiles.churnLow',
    descKey: 'argus.userProfiles.churnLowDesc',
    color: '#ff9800',
    bg: 'rgba(255,152,0,0.12)',
  },
  medium: {
    labelKey: 'argus.userProfiles.churnMedium',
    descKey: 'argus.userProfiles.churnMediumDesc',
    color: '#f44336',
    bg: 'rgba(244,67,54,0.12)',
  },
  high: {
    labelKey: 'argus.userProfiles.churnHigh',
    descKey: 'argus.userProfiles.churnHighDesc',
    color: '#b71c1c',
    bg: 'rgba(183,28,28,0.15)',
  },
  churned: {
    labelKey: 'argus.userProfiles.churnchurned',
    descKey: 'argus.userProfiles.churnChurnedDesc',
    color: '#757575',
    bg: 'rgba(117,117,117,0.12)',
  },
};

function detectReactivation(sparkline: number[]): boolean {
  if (!sparkline || sparkline.length < 10) return false;
  const recent = sparkline.slice(-5);
  const hasRecentActivity = recent.some((v) => v > 0);
  if (!hasRecentActivity) return false;
  let gapLen = 0;
  let maxGap = 0;
  for (let i = 0; i < sparkline.length - 5; i++) {
    if (sparkline[i] === 0) {
      gapLen++;
      maxGap = Math.max(maxGap, gapLen);
    } else gapLen = 0;
  }
  return maxGap >= 5;
}

interface UserProfileListItemProps {
  user: ArgusUserProfile;
  onClick: () => void;
  onStar: (e: React.MouseEvent, userId: string) => void;
  isStarred: boolean;
  isStarredSection?: boolean;
  cohorts?: CohortMembership[];
  maxEvents?: number;
}

export const UserProfileListItem: React.FC<UserProfileListItemProps> = ({
  user,
  onClick,
  onStar,
  isStarred,
  isStarredSection = false,
  cohorts = [],
  maxEvents = 1,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const risk = user.churn_risk ?? 'none';
  const churnCfg = CHURN_CONFIG[risk];
  const days = user.days_inactive ?? 0;
  const reactivated = detectReactivation(user.activity_sparkline ?? []);

  // Check if user is a Whale (revenue >= 100)
  const isWhale = (user.net_revenue ?? 0) >= 100;

  return (
    <TableRow
      hover
      onClick={onClick}
      sx={{
        cursor: 'pointer',
        ...(isStarredSection
          ? {
              bgcolor: isDark ? alpha('#ffa726', 0.04) : alpha('#ffa726', 0.03),
            }
          : {}),
      }}
    >
      {/* Star button */}
      <TableCell sx={{ p: '4px 8px', width: 36 }} onClick={(e) => e.stopPropagation()}>
        <Tooltip
          title={
            isStarred
              ? t('argus.userProfiles.unstar', 'Remove from starred')
              : t('argus.userProfiles.star', 'Star this user')
          }
        >
          <IconButton
            size="small"
            onClick={(e) => onStar(e, user.user_id)}
            sx={{
              p: 0.4,
              color: isStarred ? 'warning.main' : 'text.disabled',
              '&:hover': { color: 'warning.main' },
            }}
          >
            {isStarred ? (
              <StarIcon sx={{ fontSize: 15 }} />
            ) : (
              <StarBorderIcon sx={{ fontSize: 15 }} />
            )}
          </IconButton>
        </Tooltip>
      </TableCell>

      {/* User ID / Avatar / Email */}
      <TableCell>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {user.avatar_url ? (
            <Box
              component="img"
              src={user.avatar_url}
              alt={user.user_id}
              sx={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }}
            />
          ) : (
            <Box
              sx={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: alpha(theme.palette.primary.main, 0.12),
                color: theme.palette.primary.main,
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {user.user_id[0]?.toUpperCase() || 'U'}
            </Box>
          )}
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="body2"
              fontWeight={600}
              sx={{
                fontFamily: 'monospace',
                fontSize: 12,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: 200,
              }}
            >
              {user.user_id}
            </Typography>
            {user.email && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  fontSize: 11,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: 200,
                  display: 'block',
                  lineHeight: 1.3,
                }}
              >
                {user.email}
              </Typography>
            )}
          </Box>
        </Box>
      </TableCell>

      {/* Last Active */}
      <TableCell>
        <Typography variant="body2" fontSize={13}>
          {formatRelativeTime(user.last_seen)}
        </Typography>
      </TableCell>

      {/* First Active */}
      <TableCell>
        <Typography variant="body2" fontSize={13}>
          {formatRelativeTime(user.first_seen)}
        </Typography>
      </TableCell>

      {/* Events */}
      <TableCell align="right" sx={{ width: 60 }}>
        <Typography variant="body2" fontWeight={700} fontSize={13}>
          {user.total_events.toLocaleString()}
        </Typography>
      </TableCell>

      {/* Net Revenue */}
      <TableCell align="right" sx={{ width: 90 }}>
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
          <Typography
            variant="body2"
            fontWeight={700}
            fontSize={13}
            sx={{
              color: isWhale ? 'success.main' : 'text.primary',
            }}
          >
            ${(user.net_revenue ?? 0).toLocaleString()}
          </Typography>
          {isWhale && (
            <Tooltip title="Whale User" placement="top">
              <WhaleIcon sx={{ fontSize: 16, color: '#ffd700' }} />
            </Tooltip>
          )}
        </Box>
      </TableCell>

      {/* Purchase Count */}
      <TableCell align="right" sx={{ width: 60 }}>
        <Typography variant="body2" fontWeight={600} fontSize={13}>
          {(user.purchase_count ?? 0) > 0 ? `${user.purchase_count}x` : '—'}
        </Typography>
      </TableCell>

      {/* Activity Trend Sparkline */}
      <TableCell sx={{ width: 88, py: 0 }}>
        {user.activity_sparkline && user.activity_sparkline.length >= 2 ? (
          <ArgusSparkline
            data={user.activity_sparkline}
            width={80}
            height={24}
            color={theme.palette.primary.main}
            strokeWidth={1.5}
            showDot={false}
          />
        ) : (
          <Box
            sx={{
              width: 80,
              height: 3,
              borderRadius: 1,
              bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                height: '100%',
                width: `${Math.min(((user.total_events || 0) / (maxEvents || 1)) * 100, 100)}%`,
                bgcolor: theme.palette.primary.main,
                opacity: 0.4,
              }}
            />
          </Box>
        )}
      </TableCell>

      {/* Sessions */}
      <TableCell align="right">
        <Typography variant="body2" fontSize={13}>
          {user.total_sessions}
        </Typography>
      </TableCell>

      {/* Inactive Days */}
      <TableCell align="right" sx={{ py: 0.5 }}>
        {(() => {
          const color =
            days === 0
              ? '#4caf50'
              : days < 3
                ? '#8bc34a'
                : days < 7
                  ? '#ff9800'
                  : days < 21
                    ? '#f44336'
                    : days < 60
                      ? '#b71c1c'
                      : '#757575';
          return (
            <Typography
              sx={{
                fontSize: 12,
                fontWeight: 600,
                color,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {days === 0 ? '0d' : `${days}d`}
            </Typography>
          );
        })()}
      </TableCell>

      {/* Churn Risk */}
      <TableCell sx={{ py: 0.5 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.4 }}>
          {risk !== 'none' && churnCfg && (
            <Tooltip
              title={`${t(churnCfg.descKey, '')} · ${t('argus.userProfiles.inactiveNDays', 'Inactive for {{n}} days', { n: days })}${user.avg_session_gap_days ? ` (${t('argus.userProfiles.avgGapNDays', 'Avg interval {{n}} days', { n: user.avg_session_gap_days.toFixed(1) })})` : ''}`}
              placement="top"
            >
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.5,
                  px: 0.8,
                  py: 0.25,
                  borderRadius: 1,
                  bgcolor: churnCfg.bg,
                  width: 'fit-content',
                }}
              >
                <Box
                  sx={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    bgcolor: churnCfg.color,
                    flexShrink: 0,
                  }}
                />
                <Typography
                  sx={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: churnCfg.color,
                    lineHeight: 1,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t(churnCfg.labelKey, '')}
                </Typography>
              </Box>
            </Tooltip>
          )}
          {reactivated && (
            <Tooltip
              title={t('argus.userProfiles.reactivatedDesc', 'User returned after being inactive')}
              placement="top"
            >
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.5,
                  px: 0.8,
                  py: 0.25,
                  borderRadius: 1,
                  bgcolor: 'rgba(33,150,243,0.12)',
                  width: 'fit-content',
                }}
              >
                <Box
                  sx={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    bgcolor: '#2196f3',
                    flexShrink: 0,
                  }}
                />
                <Typography
                  sx={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#2196f3',
                    lineHeight: 1,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t('argus.userProfiles.reactivated', 'Reactivated')}
                </Typography>
              </Box>
            </Tooltip>
          )}
        </Box>
      </TableCell>

      {/* Platform */}
      <TableCell>
        {user.platform && (
          <Chip label={user.platform} size="small" sx={{ height: 22, fontSize: 11 }} />
        )}
      </TableCell>

      {/* Browser */}
      <TableCell>
        <Typography variant="body2" fontSize={13}>
          {user.browser || '—'}
        </Typography>
      </TableCell>

      {/* Country */}
      <TableCell>
        <Typography variant="body2" fontSize={13}>
          {user.country || '—'}
        </Typography>
      </TableCell>

      {/* Cohorts */}
      <TableCell>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {cohorts.map((c) => (
            <CohortChip key={c.id} cohort={c} />
          ))}
        </Box>
      </TableCell>
    </TableRow>
  );
};

export default UserProfileListItem;
