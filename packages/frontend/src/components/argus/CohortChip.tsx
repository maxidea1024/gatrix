import React from 'react';
import { Chip, Tooltip } from '@mui/material';

export interface CohortMembership {
  id: number;
  name: string;
  description: string | null;
}

interface CohortChipProps {
  cohort: CohortMembership;
  size?: 'small' | 'medium';
}

/**
 * Reusable cohort chip with tooltip showing description.
 * Used in user profile drawer, user profiles table, and wherever cohort membership is displayed.
 */
const CohortChip: React.FC<CohortChipProps> = ({ cohort, size = 'small' }) => {
  const chip = (
    <Chip
      label={cohort.name}
      size={size}
      variant="outlined"
      sx={{ fontWeight: 600, fontSize: 11 }}
    />
  );

  if (cohort.description) {
    return (
      <Tooltip title={cohort.description} arrow>
        {chip}
      </Tooltip>
    );
  }

  return chip;
};

export default CohortChip;
