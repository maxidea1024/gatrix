import React from 'react';
import {
  Card,
  CardContent,
  CardActionArea,
  Typography,
  Box,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Avatar,
  alpha,
  useTheme,
  TextField,
} from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  PushPin as PushPinIcon,
  PushPinOutlined as PushPinOutlinedIcon,
  ContentCopy as ContentCopyIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  GridOn as GridOnIcon,
  FileDownload as ExportIcon,
  Share as ShareIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import type { SpreadsheetListItem } from '@/services/spreadsheetService';
import RelativeTime from '@/components/common/RelativeTime';

interface SpreadsheetCardProps {
  item: SpreadsheetListItem;
  onOpen: (id: string) => void;
  onRename: (item: SpreadsheetListItem) => void;
  onShare: (item: SpreadsheetListItem) => void;
  onTogglePin: (item: SpreadsheetListItem) => void;
  onDuplicate: (id: string) => void;
  onExportXlsx: (item: SpreadsheetListItem) => void;
  onDelete: (item: SpreadsheetListItem) => void;
  isRenaming?: boolean;
  renameValue?: string;
  onRenameChange?: (val: string) => void;
  onRenameConfirm?: () => void;
  onRenameCancel?: () => void;
}

const ACCENT_COLORS = [
  '#4285F4',
  '#34A853',
  '#EA4335',
  '#FBBC05',
  '#8E24AA',
  '#00ACC1',
  '#F4511E',
  '#7CB342',
  '#5C6BC0',
  '#26A69A',
  '#EC407A',
  '#FFA726',
];

const SpreadsheetCard: React.FC<SpreadsheetCardProps> = ({
  item,
  onOpen,
  onRename,
  onShare,
  onTogglePin,
  onDuplicate,
  onExportXlsx,
  onDelete,
  isRenaming,
  renameValue,
  onRenameChange,
  onRenameConfirm,
  onRenameCancel,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const menuOpen = Boolean(anchorEl);

  const handleMenuClick = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    setAnchorEl(e.currentTarget);
  };
  const handleMenuClose = () => setAnchorEl(null);

  const accent = React.useMemo(() => {
    let hash = 0;
    const str = item.id || item.title;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash = hash & hash;
    }
    return ACCENT_COLORS[Math.abs(hash) % ACCENT_COLORS.length];
  }, [item.id, item.title]);

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        borderTop: `3px solid ${accent}`,
        transition: 'box-shadow 0.2s, transform 0.15s',
        '&:hover': {
          boxShadow: theme.shadows[6],
          transform: 'translateY(-2px)',
          '& .ss-card-menu': { opacity: 1 },
        },
      }}
    >
      <Menu anchorEl={anchorEl} open={menuOpen} onClose={handleMenuClose}>
        <MenuItem
          onClick={() => {
            handleMenuClose();
            setTimeout(() => onRename(item), 150);
          }}
        >
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('common.rename', 'Rename')}</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            handleMenuClose();
            onTogglePin(item);
          }}
        >
          <ListItemIcon>
            {item.isPinned ? (
              <PushPinIcon fontSize="small" />
            ) : (
              <PushPinOutlinedIcon fontSize="small" />
            )}
          </ListItemIcon>
          <ListItemText>
            {item.isPinned
              ? t('common.unpin', 'Unpin')
              : t('common.pin', 'Pin')}
          </ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            handleMenuClose();
            onDuplicate(item.id);
          }}
        >
          <ListItemIcon>
            <ContentCopyIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('common.duplicate', 'Duplicate')}</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            handleMenuClose();
            onShare(item);
          }}
        >
          <ListItemIcon>
            <ShareIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('spreadsheets.share', '공유')}</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            handleMenuClose();
            onExportXlsx(item);
          }}
        >
          <ListItemIcon>
            <ExportIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>
            {t('spreadsheets.exportXlsx', 'Export as XLSX')}
          </ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            handleMenuClose();
            onDelete(item);
          }}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>{t('common.delete', 'Delete')}</ListItemText>
        </MenuItem>
      </Menu>

      <Box
        onClick={() => onOpen(item.id)}
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          cursor: 'pointer',
        }}
      >
        {/* Header: icon + title + pin & menu */}
        <Box
          sx={{
            px: 1.5,
            pt: 1.5,
            pb: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <Avatar
            variant="rounded"
            sx={{
              width: 32,
              height: 32,
              bgcolor: alpha(accent, 0.12),
              color: accent,
              borderRadius: 1,
              flexShrink: 0,
            }}
          >
            <GridOnIcon sx={{ fontSize: 18 }} />
          </Avatar>
          <Box
            sx={{ minWidth: 0, flex: 1 }}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              // Don't re-enter rename mode if blur just completed rename
              if (!isRenaming) {
                setTimeout(() => onRename(item), 0);
              }
            }}
          >
            {isRenaming ? (
              <TextField
                size="small"
                variant="standard"
                autoFocus
                value={renameValue || ''}
                onChange={(e) => onRenameChange?.(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    (e.target as HTMLInputElement).blur();
                  }
                  if (e.key === 'Escape') {
                    onRenameCancel?.();
                  }
                }}
                onBlur={() => {
                  // Use setTimeout to let click events resolve first
                  setTimeout(() => onRenameConfirm?.(), 0);
                }}
                fullWidth
                inputProps={{
                  style: { fontSize: '0.875rem', fontWeight: 600 },
                }}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              />
            ) : (
              <Typography
                variant="subtitle2"
                noWrap
                sx={{
                  fontWeight: 600,
                  lineHeight: 1.3,
                  cursor: 'text',
                  '&:hover': {
                    textDecoration: 'underline',
                    textDecorationColor: 'text.disabled',
                  },
                }}
              >
                {item.title}
              </Typography>
            )}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0 }}>
            {item.isPinned && (
              <PushPinIcon
                sx={{
                  fontSize: 16,
                  color: 'primary.main',
                  transform: 'rotate(45deg)',
                  flexShrink: 0,
                  mr: 0.5,
                }}
              />
            )}

            {/* ⋮ Menu */}
            <IconButton
              className="ss-card-menu"
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleMenuClick(e);
              }}
              sx={{
                opacity: menuOpen ? 1 : 0,
                transition: 'opacity 0.15s',
                width: 28,
                height: 28,
                mr: -1, // Pull slightly to the right to align nicely with the card edge
              }}
            >
              <MoreVertIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Box>
        </Box>

        {/* Thumbnail area */}
        <Box
          sx={{
            mx: 1.5,
            height: 64,
            borderRadius: 1,
            overflow: 'hidden',
            border: '1px solid',
            borderColor: 'divider',
            position: 'relative',
            bgcolor: (th) =>
              th.palette.mode === 'dark'
                ? 'rgba(255,255,255,0.03)'
                : 'rgba(0,0,0,0.02)',
          }}
        >
          {item.thumbnail ? (
            <Box
              component="img"
              src={item.thumbnail}
              alt={item.title}
              sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                backgroundImage: `linear-gradient(${alpha(accent, 0.1)} 1px, transparent 1px),
                   linear-gradient(90deg, ${alpha(accent, 0.1)} 1px, transparent 1px)`,
                backgroundSize: '16px 16px',
                opacity: 0.8,
              }}
            />
          )}
        </Box>

        {/* Footer */}
        <CardContent sx={{ pt: 1, pb: '8px !important', px: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <RelativeTime date={item.updatedAt} variant="caption" />
            {item.createdByName && (
              <>
                <Typography variant="caption" color="text.disabled">
                  ·
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  noWrap
                  sx={{ flex: 1, minWidth: 0 }}
                >
                  {item.createdByName}
                </Typography>
              </>
            )}
          </Box>
        </CardContent>
      </Box>
    </Card>
  );
};

export default SpreadsheetCard;
