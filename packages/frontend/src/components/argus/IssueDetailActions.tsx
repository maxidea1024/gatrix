import React, { useState } from 'react';
import {
  Box, IconButton, Tooltip, Menu, MenuItem, ListItemIcon, ListItemText,
  Divider, Dialog, DialogTitle, DialogContent, DialogContentText,
  DialogActions, Button, alpha, useTheme, Chip,
} from '@mui/material';
import {
  Notifications as SubscribeIcon,
  NotificationsOff as UnsubscribeIcon,
  BookmarkBorder as BookmarkIcon,
  Bookmark as BookmarkedIcon,
  Share as ShareIcon,
  MoreVert as MoreIcon,
  Delete as DeleteIcon,
  Block as DiscardIcon,
  Archive as ArchiveIcon,
  ContentCopy as CopyIcon,
  Link as LinkIcon,
  ViewSidebar as ViewSidebarIcon,
  ViewSidebarOutlined as ViewSidebarOutlinedIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

interface IssueDetailActionsProps {
  projectId: string;
  issueId: string;
  shortId?: string;
  isSubscribed: boolean;
  isBookmarked: boolean;
  onSubscribe: (subscribe: boolean) => void;
  onBookmark: (bookmark: boolean) => void;
  onDelete: () => void;
  onDiscard: () => void;
  isDark: boolean;
  sidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

const IssueDetailActions: React.FC<IssueDetailActionsProps> = ({
  projectId,
  issueId,
  shortId,
  isSubscribed,
  isBookmarked,
  onSubscribe,
  onBookmark,
  onDelete,
  onDiscard,
  isDark,
  sidebarCollapsed,
  onToggleSidebar,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();

  const [moreAnchor, setMoreAnchor] = useState<HTMLElement | null>(null);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [discardDialog, setDiscardDialog] = useState(false);

  const handleShareUrl = () => {
    const url = `${window.location.origin}/argus/issues/${issueId}`;
    navigator.clipboard.writeText(url);
  };

  const handleCopyShortId = () => {
    if (shortId) {
      navigator.clipboard.writeText(shortId);
    }
  };

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        {/* Short ID */}
        {shortId && (
          <Tooltip title={t('argus.detail.copyShortId')}>
            <Chip
              label={shortId}
              size="small"
              onClick={handleCopyShortId}
              sx={{
                height: 22,
                fontSize: '0.7rem',
                fontWeight: 700,
                fontFamily: 'monospace',
                cursor: 'pointer',
                backgroundColor: alpha(theme.palette.primary.main, 0.08),
                color: theme.palette.primary.main,
                border: 'none',
                '&:hover': {
                  backgroundColor: alpha(theme.palette.primary.main, 0.15),
                },
              }}
            />
          </Tooltip>
        )}

        <Divider orientation="vertical" flexItem sx={{ mx: 0.3 }} />

        {/* Subscribe */}
        <Tooltip title={isSubscribed ? t('argus.detail.unsubscribe') : t('argus.detail.subscribe')}>
          <IconButton
            size="small"
            onClick={() => onSubscribe(!isSubscribed)}
            sx={{
              width: 28, height: 28,
              color: isSubscribed ? 'primary.main' : 'text.disabled',
              backgroundColor: isSubscribed ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
              '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.12) },
            }}
          >
            {isSubscribed ? <SubscribeIcon sx={{ fontSize: 16 }} /> : <UnsubscribeIcon sx={{ fontSize: 16 }} />}
          </IconButton>
        </Tooltip>

        {/* Bookmark */}
        <Tooltip title={isBookmarked ? t('argus.detail.removeBookmark') : t('argus.detail.bookmark')}>
          <IconButton
            size="small"
            onClick={() => onBookmark(!isBookmarked)}
            sx={{
              width: 28, height: 28,
              color: isBookmarked ? 'warning.main' : 'text.disabled',
              backgroundColor: isBookmarked ? alpha(theme.palette.warning.main, 0.08) : 'transparent',
              '&:hover': { backgroundColor: alpha(theme.palette.warning.main, 0.12) },
            }}
          >
            {isBookmarked ? <BookmarkedIcon sx={{ fontSize: 16 }} /> : <BookmarkIcon sx={{ fontSize: 16 }} />}
          </IconButton>
        </Tooltip>

        {/* Share */}
        <Tooltip title={t('argus.detail.shareLink')}>
          <IconButton
            size="small"
            onClick={handleShareUrl}
            sx={{
              width: 28, height: 28,
              color: 'text.disabled',
              '&:hover': { color: 'text.primary', backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' },
            }}
          >
            <LinkIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>

        {/* Sidebar Toggle */}
        {onToggleSidebar && (
          <Tooltip title={sidebarCollapsed ? t('argus.detail.expandSidebar', '사이드바 열기') : t('argus.detail.collapseSidebar', '사이드바 닫기')}>
            <IconButton
              size="small"
              onClick={onToggleSidebar}
              sx={{
                width: 28, height: 28,
                color: sidebarCollapsed ? 'text.primary' : 'text.disabled',
                backgroundColor: sidebarCollapsed ? (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)') : 'transparent',
                '&:hover': { color: 'text.primary', backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' },
              }}
            >
              {sidebarCollapsed ? <ViewSidebarIcon sx={{ fontSize: 16, transform: 'rotate(180deg)' }} /> : <ViewSidebarOutlinedIcon sx={{ fontSize: 16, transform: 'rotate(180deg)' }} />}
            </IconButton>
          </Tooltip>
        )}

        {/* More actions */}
        <IconButton
          size="small"
          onClick={(e) => setMoreAnchor(e.currentTarget)}
          sx={{
            width: 28, height: 28,
            color: 'text.disabled',
            '&:hover': { color: 'text.primary' },
          }}
        >
          <MoreIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Box>

      {/* More Menu */}
      <Menu
        anchorEl={moreAnchor}
        open={Boolean(moreAnchor)}
        onClose={() => setMoreAnchor(null)}
        slotProps={{
          paper: {
            sx: {
              minWidth: 180, borderRadius: '8px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
            },
          },
        }}
      >
        <MenuItem
          onClick={() => { handleCopyShortId(); setMoreAnchor(null); }}
          disabled={!shortId}
          dense
        >
          <ListItemIcon><CopyIcon fontSize="small" /></ListItemIcon>
          <ListItemText primaryTypographyProps={{ fontSize: '0.8rem' }}>
            {t('argus.detail.copyShortId')}
          </ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => { handleShareUrl(); setMoreAnchor(null); }}
          dense
        >
          <ListItemIcon><ShareIcon fontSize="small" /></ListItemIcon>
          <ListItemText primaryTypographyProps={{ fontSize: '0.8rem' }}>
            {t('argus.detail.shareLink')}
          </ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => { setDiscardDialog(true); setMoreAnchor(null); }}
          dense
        >
          <ListItemIcon><DiscardIcon fontSize="small" sx={{ color: 'warning.main' }} /></ListItemIcon>
          <ListItemText primaryTypographyProps={{ fontSize: '0.8rem', color: 'warning.main' }}>
            {t('argus.detail.discard')}
          </ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => { setDeleteDialog(true); setMoreAnchor(null); }}
          dense
        >
          <ListItemIcon><DeleteIcon fontSize="small" sx={{ color: 'error.main' }} /></ListItemIcon>
          <ListItemText primaryTypographyProps={{ fontSize: '0.8rem', color: 'error.main' }}>
            {t('argus.detail.delete')}
          </ListItemText>
        </MenuItem>
      </Menu>

      {/* Delete confirmation */}
      <Dialog
        open={deleteDialog}
        onClose={() => setDeleteDialog(false)}
        maxWidth="xs"
        PaperProps={{ sx: { borderRadius: '12px' } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>{t('argus.detail.deleteConfirmTitle')}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontSize: '0.85rem' }}>
            {t('argus.detail.deleteConfirmMessage')}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteDialog(false)} sx={{ textTransform: 'none' }}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => { setDeleteDialog(false); onDelete(); }}
            sx={{ textTransform: 'none' }}
          >
            {t('argus.detail.delete')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Discard confirmation */}
      <Dialog
        open={discardDialog}
        onClose={() => setDiscardDialog(false)}
        maxWidth="xs"
        PaperProps={{ sx: { borderRadius: '12px' } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>{t('argus.detail.discardConfirmTitle')}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontSize: '0.85rem' }}>
            {t('argus.detail.discardConfirmMessage')}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDiscardDialog(false)} sx={{ textTransform: 'none' }}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            color="warning"
            onClick={() => { setDiscardDialog(false); onDiscard(); }}
            sx={{ textTransform: 'none' }}
          >
            {t('argus.detail.discard')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default IssueDetailActions;
