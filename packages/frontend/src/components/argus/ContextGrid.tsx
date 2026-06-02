import React from 'react';
import { Box, Typography } from '@mui/material';

interface ContextGridProps {
  items: { label: string; value: string }[];
  isDark: boolean;
}

const ContextGrid: React.FC<ContextGridProps> = ({ items, isDark }) => (
  <Box sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px' }}>
    {items.map((item, idx) => (
      <React.Fragment key={`${item.label}-${idx}`}>
        <Typography variant="caption" sx={{ color: isDark ? '#666' : '#999', fontWeight: 500 }}>{item.label}</Typography>
        <Typography variant="caption" sx={{ fontFamily: 'monospace', fontWeight: 500, fontSize: '0.78rem' }}>{item.value}</Typography>
      </React.Fragment>
    ))}
  </Box>
);

export default ContextGrid;
