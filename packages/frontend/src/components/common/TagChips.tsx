import React from 'react';
import { Box, Chip, Tooltip, Typography } from '@mui/material';
import { Tag } from '@/services/tagService';
import { getContrastColor } from '@/utils/colorUtils';

interface TagChipsProps {
  /** Array of tags to display */
  tags?: Tag[] | null;
  /** Maximum number of tags to show before truncating */
  maxVisible?: number;
  /** Maximum width for the container */
  maxWidth?: number | string;
  /** Placeholder when no tags */
  emptyText?: string;
}

/**
 * Reusable component for displaying a list of tag chips.
 * Shows tooltip with tag description when available.
 */
const TagChips: React.FC<TagChipsProps> = ({
  tags,
  maxVisible,
  maxWidth,
  emptyText = '-',
}) => {
  const items = maxVisible ? (tags || []).slice(0, maxVisible) : tags || [];
  const remaining = maxVisible ? (tags || []).length - items.length : 0;

  if (items.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        {emptyText}
      </Typography>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        gap: 0.5,
        flexWrap: 'wrap',
        ...(maxWidth ? { maxWidth } : {}),
      }}
    >
      {items.map((tag) => {
        const chip = (
          <Chip
            key={tag.id}
            label={tag.name}
            size="small"
            sx={{
              bgcolor: tag.color,
              color: getContrastColor(tag.color),
            }}
          />
        );

        // Only show tooltip if tag has a description
        return tag.description ? (
          <Tooltip key={tag.id} title={tag.description} arrow>
            {chip}
          </Tooltip>
        ) : (
          chip
        );
      })}
      {remaining > 0 && (
        <Chip label={`+${remaining}`} size="small" variant="outlined" />
      )}
    </Box>
  );
};

export default TagChips;
