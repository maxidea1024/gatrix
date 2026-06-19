import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  IconButton,
  Menu,
  MenuItem,
  Divider,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  MoreVert as MoreIcon,
  DragIndicator as DragIcon,
  ContentCopy as DuplicateIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import WidgetRenderer from './renderers/WidgetRenderer';

// ─── Re-export types from the canonical source ───
export type {
  WidgetConfig,
  WidgetQuery,
  WidgetType,
  VizOptions,
  DashboardData,
  PresetSummary,
} from './renderers/widgetTypes';

// Import the type locally for use in this file
import type { WidgetConfig } from './renderers/widgetTypes';

// ─── WidgetCard ───

interface WidgetCardProps {
  widget: WidgetConfig;
  data: any[];
  loading: boolean;
  isDark: boolean;
  isEditing: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

export const WidgetCard: React.FC<WidgetCardProps> = ({
  widget,
  data,
  loading,
  isDark,
  isEditing,
  onEdit,
  onDelete,
  onDuplicate,
}) => {
  const { t } = useTranslation();
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  return (
    <Paper
      elevation={0}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        borderRadius: 2,
        overflow: 'hidden',
        '&:hover': {
          borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
        },
        transition: 'border-color 0.15s',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          px: 1.5,
          py: 0.75,
          borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
          backgroundColor: isDark
            ? 'rgba(255,255,255,0.015)'
            : 'rgba(0,0,0,0.008)',
        }}
      >
        {isEditing && (
          <DragIcon
            className="drag-handle"
            sx={{
              fontSize: 16,
              color: 'text.disabled',
              cursor: 'grab',
              '&:active': { cursor: 'grabbing' },
            }}
          />
        )}
        <Typography
          variant="caption"
          fontWeight={700}
          sx={{ flex: 1, fontSize: '0.75rem' }}
        >
          {widget.title}
        </Typography>
        {/* VertMore menu — always visible */}
        <IconButton
          size="small"
          onClick={(e) => setMenuAnchor(e.currentTarget)}
          sx={{ p: 0.25 }}
        >
          <MoreIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
        </IconButton>
        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={() => setMenuAnchor(null)}
          PaperProps={{ sx: { minWidth: 160, borderRadius: '8px' } }}
        >
          {isEditing && (
            <MenuItem
              onClick={() => {
                onEdit();
                setMenuAnchor(null);
              }}
              sx={{ fontSize: '0.8rem' }}
            >
              <ListItemIcon>
                <EditIcon sx={{ fontSize: 16 }} />
              </ListItemIcon>
              <ListItemText primaryTypographyProps={{ fontSize: '0.8rem' }}>
                {t('common.edit', 'Edit')}
              </ListItemText>
            </MenuItem>
          )}
          <MenuItem
            onClick={() => {
              onDuplicate();
              setMenuAnchor(null);
            }}
            sx={{ fontSize: '0.8rem' }}
          >
            <ListItemIcon>
              <DuplicateIcon sx={{ fontSize: 16 }} />
            </ListItemIcon>
            <ListItemText primaryTypographyProps={{ fontSize: '0.8rem' }}>
              {t('common.duplicate', 'Duplicate')}
            </ListItemText>
          </MenuItem>
          {isEditing && (
            <>
              <Divider />
              <MenuItem
                onClick={() => {
                  onDelete();
                  setMenuAnchor(null);
                }}
                sx={{ fontSize: '0.8rem', color: 'error.main' }}
              >
                <ListItemIcon>
                  <DeleteIcon sx={{ fontSize: 16, color: 'error.main' }} />
                </ListItemIcon>
                <ListItemText primaryTypographyProps={{ fontSize: '0.8rem' }}>
                  {t('common.delete', 'Delete')}
                </ListItemText>
              </MenuItem>
            </>
          )}
        </Menu>
      </Box>

      {/* Content — delegated to WidgetRenderer */}
      <Box sx={{ flex: 1, p: 1.5, overflow: 'hidden' }}>
        <WidgetRenderer
          widget={widget}
          data={data}
          loading={loading}
          isDark={isDark}
        />
      </Box>
    </Paper>
  );
};
