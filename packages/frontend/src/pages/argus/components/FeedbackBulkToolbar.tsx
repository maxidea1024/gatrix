import React, { useState, useCallback } from 'react';
import {
  Paper,
  Typography,
  Button,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Avatar,
  alpha,
} from '@mui/material';
import {
  CheckCircleOutline as ResolveIcon,
  ReportProblem as SpamIcon,
  PersonAdd as AssignIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { stringToColor, getInitials } from '@/utils/argusHelpers';

interface FeedbackBulkToolbarProps {
  selectedCount: number;
  members: any[];
  onBulkAction: (action: 'resolve' | 'unresolve' | 'spam') => void;
  onBulkAssign: (assignee: string) => void;
  onClearSelection: () => void;
}

const FeedbackBulkToolbar: React.FC<FeedbackBulkToolbarProps> = ({
  selectedCount,
  members,
  onBulkAction,
  onBulkAssign,
  onClearSelection,
}) => {
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const handleOpenMenu = useCallback(
    (e: React.MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget),
    []
  );
  const handleCloseMenu = useCallback(() => setAnchorEl(null), []);

  const handleAssign = useCallback(
    (assignee: string) => {
      onBulkAssign(assignee);
      setAnchorEl(null);
    },
    [onBulkAssign]
  );

  return (
    <>
      <Paper
        elevation={0}
        sx={{
          mb: 1,
          p: 0.8,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          border: `1px solid ${alpha('#7c4dff', 0.3)}`,
          borderRadius: 1.5,
          backgroundColor: alpha('#7c4dff', 0.04),
          flexShrink: 0,
        }}
      >
        <Typography
          variant="body2"
          fontWeight={600}
          sx={{ fontSize: '0.76rem' }}
        >
          {selectedCount} {t('argus.issues.selected')}
        </Typography>
        <Button
          size="small"
          startIcon={<ResolveIcon />}
          onClick={() => onBulkAction('resolve')}
          sx={{
            textTransform: 'none',
            fontSize: '0.72rem',
            borderRadius: '6px',
          }}
        >
          {t('argus.feedback.resolve')}
        </Button>
        <Button
          size="small"
          startIcon={<SpamIcon />}
          onClick={() => onBulkAction('spam')}
          sx={{
            textTransform: 'none',
            fontSize: '0.72rem',
            borderRadius: '6px',
          }}
        >
          {t('argus.feedback.markSpam')}
        </Button>
        <Button
          size="small"
          startIcon={<AssignIcon />}
          onClick={handleOpenMenu}
          sx={{
            textTransform: 'none',
            fontSize: '0.72rem',
            borderRadius: '6px',
          }}
        >
          {t('argus.feedback.assign')}
        </Button>
        <Button
          size="small"
          onClick={onClearSelection}
          sx={{ textTransform: 'none', fontSize: '0.72rem', ml: 'auto' }}
        >
          {t('common.cancel')}
        </Button>
      </Paper>

      {/* Bulk Assignee Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleCloseMenu}
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
                primary={dn}
                primaryTypographyProps={{ fontSize: '0.82rem' }}
              />
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
};

export default React.memo(FeedbackBulkToolbar);
