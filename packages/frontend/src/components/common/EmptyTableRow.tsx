import React from 'react';
import { TableRow, TableCell, Typography, CircularProgress, Box } from '@mui/material';

interface EmptyTableRowProps {
  colSpan: number;
  loading?: boolean;
  message: string;
  loadingMessage?: string;
}

const EmptyTableRow: React.FC<EmptyTableRowProps> = ({
  colSpan,
  loading = false,
  message,
  loadingMessage = "로딩 중..."
}) => {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} align="center" sx={{ py: 8, minHeight: 150 }}>
        {loading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <CircularProgress size={24} />
            <Typography variant="body1" color="text.secondary">
              {loadingMessage}
            </Typography>
          </Box>
        ) : (
          <Typography variant="body1" color="text.secondary">
            {message}
          </Typography>
        )}
      </TableCell>
    </TableRow>
  );
};

export default EmptyTableRow;
