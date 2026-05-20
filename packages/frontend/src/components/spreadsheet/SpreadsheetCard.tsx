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
  Chip,
} from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  PushPin as PushPinIcon,
  PushPinOutlined as PushPinOutlinedIcon,
  ContentCopy as ContentCopyIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  GridOn as GridOnIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import type { SpreadsheetListItem } from '@/services/spreadsheetService';

interface SpreadsheetCardProps {
  item: SpreadsheetListItem;
  onOpen: (id: string) => void;
  onRename: (item: SpreadsheetListItem) => void;
  onTogglePin: (item: SpreadsheetListItem) => void;
  onDuplicate: (id: string) => void;
  onDelete: (item: SpreadsheetListItem) => void;
}

const SpreadsheetCard: React.FC<SpreadsheetCardProps> = ({
  item,
  onOpen,
  onRename,
  onTogglePin,
  onDuplicate,
  onDelete,
}) => {
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const menuOpen = Boolean(anchorEl);

  const handleMenuClick = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    setAnchorEl(e.currentTarget);
  };

  const handleMenuClose = () => setAnchorEl(null);

  const timeAgo = (dateStr: string): string => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t('common.justNow', 'Just now');
    if (mins < 60) return t('common.minutesAgo', '{{count}}m ago', { count: mins });
    const hours = Math.floor(mins / 60);
    if (hours < 24) return t('common.hoursAgo', '{{count}}h ago', { count: hours });
    const days = Math.floor(hours / 24);
    if (days < 30) return t('common.daysAgo', '{{count}}d ago', { count: days });
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'box-shadow 0.2s, transform 0.15s',
        '&:hover': {
          boxShadow: 6,
          transform: 'translateY(-2px)',
        },
        position: 'relative',
      }}
    >
      {/* Pin indicator */}
      {item.isPinned && (
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            left: 8,
            zIndex: 1,
          }}
        >
          <PushPinIcon sx={{ fontSize: 16, color: 'primary.main', transform: 'rotate(45deg)' }} />
        </Box>
      )}

      {/* Context menu button */}
      <IconButton
        size="small"
        onClick={handleMenuClick}
        sx={{
          position: 'absolute',
          top: 4,
          right: 4,
          zIndex: 1,
          opacity: 0.6,
          '&:hover': { opacity: 1 },
        }}
      >
        <MoreVertIcon fontSize="small" />
      </IconButton>

      <Menu anchorEl={anchorEl} open={menuOpen} onClose={handleMenuClose}>
        <MenuItem
          onClick={() => {
            handleMenuClose();
            onRename(item);
          }}
        >
          <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
          <ListItemText>{t('common.rename', 'Rename')}</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            handleMenuClose();
            onTogglePin(item);
          }}
        >
          <ListItemIcon>
            {item.isPinned ? <PushPinIcon fontSize="small" /> : <PushPinOutlinedIcon fontSize="small" />}
          </ListItemIcon>
          <ListItemText>
            {item.isPinned ? t('common.unpin', 'Unpin') : t('common.pin', 'Pin')}
          </ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            handleMenuClose();
            onDuplicate(item.id);
          }}
        >
          <ListItemIcon><ContentCopyIcon fontSize="small" /></ListItemIcon>
          <ListItemText>{t('common.duplicate', 'Duplicate')}</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            handleMenuClose();
            onDelete(item);
          }}
          sx={{ color: 'error.main' }}
        >
          <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
          <ListItemText>{t('common.delete', 'Delete')}</ListItemText>
        </MenuItem>
      </Menu>

      {/* Card body */}
      <CardActionArea onClick={() => onOpen(item.id)} sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
        {/* Thumbnail area */}
        <Box
          sx={{
            height: 120,
            bgcolor: 'action.hover',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderBottom: '1px solid',
            borderColor: 'divider',
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
            <GridOnIcon sx={{ fontSize: 48, color: 'action.disabled' }} />
          )}
        </Box>

        <CardContent sx={{ flex: 1, pt: 1.5, pb: '12px !important' }}>
          <Typography
            variant="subtitle2"
            noWrap
            sx={{ fontWeight: 600, mb: 0.5 }}
          >
            {item.title}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography variant="caption" color="text.secondary">
              {timeAgo(item.updatedAt)}
            </Typography>
            {item.createdByName && (
              <Chip
                label={item.createdByName}
                size="small"
                variant="outlined"
                sx={{ height: 18, fontSize: '0.65rem' }}
              />
            )}
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  );
};

export default SpreadsheetCard;
