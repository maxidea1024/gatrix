/**
 * ShareIssueButton — G13: Issue sharing functionality.
 *
 * Provides multiple sharing options:
 * - Copy link to clipboard
 * - Copy as Markdown format
 * - Copy with event context
 */
import React, { useState } from 'react';
import {
  Box,
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Typography,
  Snackbar,
  alpha,
  useTheme,
} from '@mui/material';
import {
  Share as ShareIcon,
  Link as LinkIcon,
  ContentCopy as CopyIcon,
  Code as MarkdownIcon,
  CheckCircle as DoneIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

interface ShareIssueButtonProps {
  projectSlug: string;
  issueId: string;
  issueTitle: string;
  shortId: string;
  currentEventId?: string;
}

const ShareIssueButton: React.FC<ShareIssueButtonProps> = ({
  projectSlug,
  issueId,
  issueTitle,
  shortId,
  currentEventId,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [snackOpen, setSnackOpen] = useState(false);
  const [snackMessage, setSnackMessage] = useState('');

  const baseUrl = `${window.location.origin}/argus/issues/${projectSlug}/${issueId}`;
  const eventUrl = currentEventId
    ? `${baseUrl}?event=${currentEventId}`
    : baseUrl;

  const copyToClipboard = (text: string, message: string) => {
    navigator.clipboard.writeText(text);
    setSnackMessage(message);
    setSnackOpen(true);
    setAnchorEl(null);
  };

  const handleCopyLink = () => {
    copyToClipboard(eventUrl, t('argus.share.linkCopied'));
  };

  const handleCopyMarkdown = () => {
    const md = `[${shortId}](${eventUrl}) ${issueTitle}`;
    copyToClipboard(md, t('argus.share.markdownCopied'));
  };

  const handleCopyShortId = () => {
    copyToClipboard(shortId, t('argus.share.shortIdCopied'));
  };

  return (
    <>
      <Tooltip title={t('argus.share.title')}>
        <IconButton
          size="small"
          onClick={(e) => setAnchorEl(e.currentTarget)}
          sx={{
            width: 30,
            height: 30,
            border: `1px solid ${alpha(theme.palette.divider, 0.3)}`,
            borderRadius: '6px',
            '&:hover': {
              backgroundColor: alpha(theme.palette.primary.main, 0.06),
              borderColor: theme.palette.primary.main,
            },
          }}
        >
          <ShareIcon sx={{ fontSize: 15 }} />
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        slotProps={{
          paper: {
            sx: {
              minWidth: 220,
              borderRadius: '10px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            },
          },
        }}
      >
        <Box sx={{ px: 2, py: 0.5, mb: 0.5 }}>
          <Typography
            sx={{
              fontSize: '0.7rem',
              fontWeight: 700,
              color: 'text.disabled',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            {t('argus.share.title')}
          </Typography>
        </Box>

        <MenuItem onClick={handleCopyLink} dense>
          <ListItemIcon>
            <LinkIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary={t('argus.share.copyLink')}
            secondary={currentEventId ? t('argus.share.withEvent') : undefined}
            primaryTypographyProps={{ fontSize: '0.78rem' }}
            secondaryTypographyProps={{ fontSize: '0.65rem' }}
          />
        </MenuItem>

        <MenuItem onClick={handleCopyMarkdown} dense>
          <ListItemIcon>
            <MarkdownIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary={t('argus.share.copyMarkdown')}
            primaryTypographyProps={{ fontSize: '0.78rem' }}
          />
        </MenuItem>

        <Divider />

        <MenuItem onClick={handleCopyShortId} dense>
          <ListItemIcon>
            <CopyIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary={t('argus.share.copyShortId')}
            secondary={shortId}
            primaryTypographyProps={{ fontSize: '0.78rem' }}
            secondaryTypographyProps={{ fontSize: '0.65rem' }}
          />
        </MenuItem>
      </Menu>

      <Snackbar
        open={snackOpen}
        autoHideDuration={2000}
        onClose={() => setSnackOpen(false)}
        message={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <DoneIcon sx={{ fontSize: 16, color: '#4caf50' }} />
            {snackMessage}
          </Box>
        }
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </>
  );
};

export default ShareIssueButton;
