import React from 'react';
import {
  Menu,
  MenuItem,
  Avatar,
  Divider,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import { Person as PersonIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { ArgusIssue } from '@/services/argusService';
import { stringToColor, getInitials } from '@/utils/argusHelpers';

interface IssueAssigneeMenuProps {
  /** The current anchor state (element + issue), or null if closed */
  anchor: { el: HTMLElement; issue: ArgusIssue } | null;
  /** List of project members */
  members: { userId: string; name?: string; email?: string }[];
  /** Called to close the menu */
  onClose: () => void;
  /** Called when a member is selected (empty string = unassign) */
  onAssign: (issueId: number | undefined, assignee: string) => void;
}

/**
 * Dropdown menu for assigning / unassigning an issue to a project member.
 */
const IssueAssigneeMenu: React.FC<IssueAssigneeMenuProps> = ({
  anchor,
  members,
  onClose,
  onAssign,
}) => {
  const { t } = useTranslation();

  return (
    <Menu
      anchorEl={anchor?.el}
      open={Boolean(anchor)}
      onClose={onClose}
      slotProps={{ paper: { sx: { borderRadius: 2, minWidth: 160, maxHeight: 300, boxShadow: '0 4px 20px rgba(0,0,0,0.12)' } } }}
    >
      <MenuItem onClick={() => onAssign(anchor?.issue.id, '')}>
        <ListItemIcon><PersonIcon sx={{ fontSize: 18 }} /></ListItemIcon>
        <ListItemText primary={t('argus.issues.unassigned')} primaryTypographyProps={{ fontSize: '0.82rem' }} />
      </MenuItem>
      <Divider />
      {members.map(member => {
        const displayName = member.name || member.email || member.userId;
        return (
          <MenuItem key={member.userId} onClick={() => onAssign(anchor?.issue?.id, displayName)}>
            <Avatar sx={{ width: 20, height: 20, mr: 1, fontSize: '0.55rem', fontWeight: 700, backgroundColor: stringToColor(displayName) }}>
              {getInitials(displayName)}
            </Avatar>
            <ListItemText primary={displayName} primaryTypographyProps={{ fontSize: '0.82rem' }} />
          </MenuItem>
        );
      })}
    </Menu>
  );
};

export default React.memo(IssueAssigneeMenu);
