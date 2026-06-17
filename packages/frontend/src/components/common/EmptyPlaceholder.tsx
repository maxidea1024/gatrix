import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';

interface EmptyPlaceholderProps {
  /** Main message to display */
  message: string;
  /** Optional description text below the message */
  description?: string;
  /** Optional icon element to display above the message */
  icon?: React.ReactNode;
  /** If provided, shows an add button */
  onAddClick?: () => void;
  /** Label for the add button */
  addButtonLabel?: string;
  /** Button variant (default: 'contained') */
  addButtonVariant?: 'text' | 'contained' | 'outlined';
  /** Custom content to render instead of the default add button */
  children?: React.ReactNode;
  /** Minimum height of the placeholder */
  minHeight?: number | string;
  /**
   * Display variant:
   * - 'bordered' (default): dashed border container — for editable/interactive areas
   * - 'text': no border/background — for read-only informational empty states
   */
  variant?: 'bordered' | 'text';
  /** Additional styles */
  sx?: any;
}

/**
 * Unified empty state placeholder for sections with no items yet.
 * Provides consistent styling with optional dashed border,
 * centered text with optional add button.
 */
const EmptyPlaceholder: React.FC<EmptyPlaceholderProps> = ({
  message,
  description,
  icon,
  onAddClick,
  addButtonLabel,
  addButtonVariant = 'contained',
  children,
  minHeight,
  variant = 'bordered',
  sx = {},
}) => {
  const isBordered = variant === 'bordered';

  return (
    <Box
      sx={{
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: minHeight || 240,
        py: 5,
        px: 3,
        ...(isBordered && {
          border: '2px dashed',
          borderColor: (theme) =>
            theme.palette.mode === 'dark'
              ? 'rgba(255,255,255,0.1)'
              : 'rgba(0,0,0,0.1)',
          borderRadius: '16px',
          backgroundColor: (theme) =>
            theme.palette.mode === 'dark'
              ? 'rgba(255,255,255,0.01)'
              : 'rgba(0,0,0,0.01)',
        }),
        ...sx,
      }}
    >
      {icon && (
        <Box
          sx={{
            mb: 2,
            color: 'text.secondary',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            width: 72,
            height: 72,
            borderRadius: '50%',
            backgroundColor: (theme) =>
              theme.palette.mode === 'dark'
                ? 'rgba(255,255,255,0.05)'
                : 'rgba(0,0,0,0.03)',
            '& svg': {
              fontSize: 36,
            },
          }}
        >
          {icon}
        </Box>
      )}
      <Typography
        variant="h6"
        color="text.primary"
        fontWeight={600}
        sx={{ mb: 0.5 }}
      >
        {message}
      </Typography>
      {description && (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ display: 'block', mb: 1, px: 2, maxWidth: 400 }}
        >
          {description}
        </Typography>
      )}
      {children
        ? children
        : onAddClick && (
            <Button
              variant={addButtonVariant}
              size="medium"
              startIcon={<AddIcon />}
              onClick={onAddClick}
              sx={{
                mt: 2,
                textTransform: 'none',
                fontWeight: 600,
                px: 3,
                boxShadow: addButtonVariant === 'contained' ? 2 : 0,
              }}
            >
              {addButtonLabel}
            </Button>
          )}
    </Box>
  );
};

export default EmptyPlaceholder;
