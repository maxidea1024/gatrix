import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';

interface EmptyPlaceholderProps {
  /** Main message to display */
  message: string;
  /** Optional description text below the message */
  description?: string;
  /** If provided, shows an add button */
  onAddClick?: () => void;
  /** Label for the add button */
  addButtonLabel?: string;
  /** Button variant (default: 'contained') */
  addButtonVariant?: 'text' | 'contained' | 'outlined';
  /** Custom content to render instead of the default add button */
  children?: React.ReactNode;
}

/**
 * Unified empty state placeholder for sections with no items yet.
 * Provides consistent styling: dashed border, slightly darker background,
 * centered text with optional add button.
 */
const EmptyPlaceholder: React.FC<EmptyPlaceholderProps> = ({
  message,
  description,
  onAddClick,
  addButtonLabel,
  addButtonVariant = 'contained',
  children,
}) => {
  return (
    <Box
      sx={{
        textAlign: 'center',
        py: 3,
        px: 3,
        border: '2px dashed',
        borderColor: 'divider',
        borderRadius: '4px',
        bgcolor: 'action.hover',
      }}
    >
      <Typography variant="body2" color="text.secondary" fontWeight={500}>
        {message}
      </Typography>
      {description && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', mt: 0.5, px: 2 }}
        >
          {description}
        </Typography>
      )}
      {children
        ? children
        : onAddClick && (
          <Button
            variant={addButtonVariant}
            size="small"
            startIcon={<AddIcon />}
            onClick={onAddClick}
            sx={{ mt: 1.5 }}
          >
            {addButtonLabel}
          </Button>
        )}
    </Box>
  );
};

export default EmptyPlaceholder;
