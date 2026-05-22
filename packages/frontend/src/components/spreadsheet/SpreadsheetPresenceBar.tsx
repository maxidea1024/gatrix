import React from 'react';
import {
  Box,
  Avatar,
  AvatarGroup,
  Chip,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Edit as EditIcon,
  Lock as LockIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import type {
  CollabViewer,
  CollabLockInfo,
} from '@/services/spreadsheetCollabService';

// ==================== Types ====================

interface SpreadsheetPresenceBarProps {
  viewers: CollabViewer[];
  lock: CollabLockInfo | null;
  currentUserId: string;
  isEditing: boolean;
}

// ==================== Helpers ====================

/** Get initials from a user name (up to 2 characters). */
function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/** Generate a consistent color from a userId. */
function stringToColor(str: string): string {
  const colors = [
    '#6366f1',
    '#8b5cf6',
    '#a855f7',
    '#ec4899',
    '#f43f5e',
    '#ef4444',
    '#f97316',
    '#eab308',
    '#22c55e',
    '#14b8a6',
    '#06b6d4',
    '#3b82f6',
    '#2563eb',
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

// ==================== Component ====================

const SpreadsheetPresenceBar: React.FC<SpreadsheetPresenceBarProps> = ({
  viewers,
  lock,
  currentUserId,
  isEditing,
}) => {
  const { t } = useTranslation();

  const isLockedByOther = lock && lock.userId !== currentUserId;
  const isLockedByMe = lock && lock.userId === currentUserId;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      {/* Lock status chip */}
      {isLockedByMe && (
        <Chip
          icon={<EditIcon sx={{ fontSize: 14 }} />}
          label={t('spreadsheets.editing')}
          size="small"
          color="success"
          variant="outlined"
          sx={{ height: 26, fontSize: '0.75rem' }}
        />
      )}

      {isLockedByOther && (
        <Chip
          icon={<LockIcon sx={{ fontSize: 14 }} />}
          label={t('spreadsheets.editingBy', '{{name}} is editing', {
            name: lock!.userName,
          })}
          size="small"
          color="warning"
          variant="filled"
          sx={{ height: 26, fontSize: '0.75rem' }}
        />
      )}

      {!lock && !isEditing && viewers.length > 1 && (
        <Chip
          icon={<ViewIcon sx={{ fontSize: 14 }} />}
          label={t('spreadsheets.viewers', '{{count}} viewer(s)', {
            count: viewers.length,
          })}
          size="small"
          variant="outlined"
          sx={{ height: 26, fontSize: '0.75rem', color: 'text.secondary' }}
        />
      )}

      {/* Viewer avatars */}
      {viewers.length > 0 && (
        <AvatarGroup
          max={5}
          sx={{
            '& .MuiAvatar-root': {
              width: 26,
              height: 26,
              fontSize: '0.7rem',
              border: '2px solid',
              borderColor: 'background.paper',
            },
          }}
        >
          {viewers.map((viewer) => (
            <Tooltip key={viewer.userId} title={viewer.userName} arrow>
              <Avatar
                sx={{
                  bgcolor: stringToColor(viewer.userId),
                  ...(lock?.userId === viewer.userId && {
                    boxShadow: (theme) =>
                      `0 0 0 2px ${theme.palette.success.main}`,
                  }),
                }}
              >
                {getInitials(viewer.userName)}
              </Avatar>
            </Tooltip>
          ))}
        </AvatarGroup>
      )}
    </Box>
  );
};

export default SpreadsheetPresenceBar;
