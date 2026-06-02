import React, { useState } from 'react';
import { Box, Typography, Button, useTheme, Menu, MenuItem, ListItemIcon, ListItemText, IconButton, Tooltip } from '@mui/material';
import { useTranslation } from 'react-i18next';
import GitHubIcon from '@mui/icons-material/GitHub';
import AddIcon from '@mui/icons-material/Add';

// SVG for Jira since it's not a standard Material Icon
const JiraIcon = (props: any) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M11.53 2C6.28 2 2.03 6.25 2.03 11.5C2.03 16.75 6.28 21 11.53 21C16.78 21 21.03 16.75 21.03 11.5C21.03 6.25 16.78 2 11.53 2ZM15.97 8.81L11.12 15.5C11.04 15.61 10.93 15.69 10.8 15.74C10.68 15.78 10.54 15.79 10.41 15.75C10.28 15.72 10.16 15.65 10.07 15.55L7.34 12.56C7.17 12.38 7.18 12.09 7.36 11.92C7.54 11.75 7.83 11.76 8 11.94L10.52 14.69L15.17 8.31C15.32 8.11 15.61 8.07 15.81 8.22C16.01 8.37 16.05 8.65 15.9 8.85L15.97 8.81Z" fill="currentColor"/>
  </svg>
);

interface IssueTrackerWidgetProps {
  projectId: string | number;
  issueId: string | number;
  isDark: boolean;
}

const IssueTrackerWidget: React.FC<IssueTrackerWidgetProps> = ({ projectId, issueId, isDark }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  return (
    <Box>
      {/* Header: "Issue Tracking — Manage" */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="caption" fontWeight={700} sx={{
          fontSize: '0.7rem',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'text.secondary',
        }}>
          {t('argus.issues.issueTracking')}
        </Typography>
        <Typography
          component="span"
          onClick={handleClick}
          sx={{
            fontSize: '0.72rem',
            color: theme.palette.primary.main,
            cursor: 'pointer',
            '&:hover': { textDecoration: 'underline' },
          }}
        >
          {t('argus.issues.manage')}
        </Typography>
      </Box>

      {/* Integration icons row */}
      <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
        <Tooltip title="GitHub">
          <IconButton
            size="small"
            sx={{
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
              borderRadius: 1,
              p: 0.6,
              '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' },
            }}
          >
            <GitHubIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="Jira">
          <IconButton
            size="small"
            sx={{
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
              borderRadius: 1,
              p: 0.6,
              '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' },
            }}
          >
            <JiraIcon width={16} height={16} />
          </IconButton>
        </Tooltip>
      </Box>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        slotProps={{ paper: { sx: { borderRadius: 2, minWidth: 200, boxShadow: '0 4px 20px rgba(0,0,0,0.12)' } } }}
      >
        <MenuItem onClick={handleClose}>
          <ListItemIcon><GitHubIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary={t('argus.issues.linkGithubIssue')} primaryTypographyProps={{ fontSize: '0.85rem' }} />
        </MenuItem>
        <MenuItem onClick={handleClose}>
          <ListItemIcon><JiraIcon width={18} height={18} /></ListItemIcon>
          <ListItemText primary={t('argus.issues.linkJiraTicket')} primaryTypographyProps={{ fontSize: '0.85rem' }} />
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default IssueTrackerWidget;
