import React from 'react';
import { Box, Typography, Chip, Checkbox, alpha } from '@mui/material';
import {
  BugReport as BugReportIcon,
  Image as ImageIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { formatRelativeTime } from '@/utils/dateFormat';
import HighlightText from '@/components/common/HighlightText';
import { ArgusFeedbackItem } from '@/services/argusService';
import { ARGUS_SEMANTIC } from '../argusThemeTokens';

const statusColor = (s: string) => {
  if (s === 'resolved') return ARGUS_SEMANTIC.positive;
  if (s === 'spam') return '#9e9e9e';
  return ARGUS_SEMANTIC.warning;
};

interface FeedbackListItemProps {
  item: ArgusFeedbackItem;
  isActive: boolean;
  isSelected: boolean;
  isDark: boolean;
  searchHighlight: string;
  onSelect: (feedbackId: string) => void;
  onToggleCheck: (feedbackId: string) => void;
}

const FeedbackListItem: React.FC<FeedbackListItemProps> = ({
  item,
  isActive,
  isSelected,
  isDark,
  searchHighlight,
  onSelect,
  onToggleCheck,
}) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const displayName =
    item.name || item.email?.split('@')[0] || t('argus.feedback.anonymous');

  return (
    <Box
      onClick={() => onSelect(item.feedback_id)}
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1,
        px: 1.5,
        py: 1.2,
        cursor: 'pointer',
        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
        backgroundColor: isActive
          ? alpha('#7c4dff', isDark ? 0.12 : 0.06)
          : isSelected
            ? alpha('#7c4dff', 0.03)
            : 'transparent',
        borderLeft: isActive ? `3px solid #7c4dff` : '3px solid transparent',
        transition: 'all 0.1s',
        '&:hover': {
          backgroundColor: isActive
            ? alpha('#7c4dff', isDark ? 0.15 : 0.08)
            : isDark
              ? 'rgba(255,255,255,0.02)'
              : 'rgba(0,0,0,0.015)',
        },
      }}
    >
      <Checkbox
        size="small"
        checked={isSelected}
        onChange={() => onToggleCheck(item.feedback_id)}
        onClick={(e) => e.stopPropagation()}
        sx={{ p: 0.2, mt: 0.2 }}
      />
      <Box
        sx={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          mt: 0.8,
          flexShrink: 0,
          backgroundColor: statusColor(item.status),
        }}
      />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.2 }}>
          <Typography
            variant="body2"
            fontWeight={item.is_read ? 600 : 800}
            noWrap
            sx={{ fontSize: '0.8rem', flex: 1 }}
          >
            <HighlightText
              text={displayName}
              highlight={searchHighlight}
              isDark={isDark}
            />
          </Typography>
          <Typography
            variant="caption"
            sx={{
              color: isDark ? '#666' : '#999',
              fontSize: '0.62rem',
              flexShrink: 0,
            }}
          >
            {formatRelativeTime(item.submitted_at)}
          </Typography>
        </Box>
        <Typography
          variant="caption"
          noWrap
          sx={{
            color: isDark ? '#999' : '#666',
            fontSize: '0.72rem',
            display: 'block',
            lineHeight: 1.4,
            maxHeight: '2.8em',
            overflow: 'hidden',
          }}
        >
          <HighlightText
            text={item.message}
            highlight={searchHighlight}
            isDark={isDark}
          />
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.5, mt: 0.4, flexWrap: 'wrap' }}>
          {item.issue_id &&
            (() => {
              const issueColor =
                item.issue_status === 'resolved'
                  ? ARGUS_SEMANTIC.positive
                  : item.issue_status === 'ignored'
                    ? '#9e9e9e'
                    : ARGUS_SEMANTIC.warning;
              return (
                <Chip
                  icon={<BugReportIcon sx={{ fontSize: '10px !important' }} />}
                  label={`#${item.issue_id} ${item.issue_status || ''}`}
                  size="small"
                  sx={{
                    height: 16,
                    fontSize: '0.55rem',
                    backgroundColor: alpha(issueColor, 0.08),
                    color: issueColor,
                    border: 'none',
                    '& .MuiChip-icon': { color: issueColor },
                  }}
                />
              );
            })()}
          {item.attachments?.length > 0 && (
            <Chip
              icon={<ImageIcon sx={{ fontSize: '10px !important' }} />}
              label={item.attachments.length}
              size="small"
              sx={{
                height: 16,
                fontSize: '0.55rem',
                backgroundColor: alpha(ARGUS_SEMANTIC.info, 0.08),
                color: ARGUS_SEMANTIC.info,
                border: 'none',
                '& .MuiChip-icon': { color: ARGUS_SEMANTIC.info },
              }}
            />
          )}
          {item.assigned_to && (
            <Chip
              label={
                user &&
                (item.assigned_to === user.name ||
                  item.assigned_to === user.email)
                  ? t('argus.issues.assigneeMe', { name: item.assigned_to })
                  : item.assigned_to
              }
              size="small"
              sx={{
                height: 16,
                fontSize: '0.55rem',
                backgroundColor: alpha(ARGUS_SEMANTIC.positive, 0.08),
                color: ARGUS_SEMANTIC.positive,
                border: 'none',
              }}
            />
          )}
          {item.sentiment && item.sentiment !== '' && (
            <Chip
              label={item.sentiment}
              size="small"
              sx={{
                height: 16,
                fontSize: '0.55rem',
                border: 'none',
                backgroundColor: alpha(
                  item.sentiment === 'positive'
                    ? ARGUS_SEMANTIC.positive
                    : item.sentiment === 'negative'
                      ? ARGUS_SEMANTIC.negative
                      : '#9e9e9e',
                  0.08
                ),
                color:
                  item.sentiment === 'positive'
                    ? ARGUS_SEMANTIC.positive
                    : item.sentiment === 'negative'
                      ? ARGUS_SEMANTIC.negative
                      : '#9e9e9e',
              }}
            />
          )}
          {item.category &&
            item.category !== '' &&
            item.category !== 'other' && (
              <Chip
                label={item.category.replace('_', ' ')}
                size="small"
                sx={{
                  height: 16,
                  fontSize: '0.55rem',
                  backgroundColor: alpha('#7c4dff', 0.08),
                  color: '#7c4dff',
                  border: 'none',
                }}
              />
            )}
        </Box>
      </Box>
    </Box>
  );
};

export default React.memo(FeedbackListItem);
