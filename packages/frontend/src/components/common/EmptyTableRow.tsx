import React from 'react';
import { TableRow, TableCell, Typography, CircularProgress, Box } from '@mui/material';
import { useTranslation } from 'react-i18next';

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
  loadingMessage
}) => {
  const { t } = useTranslation();
  return (
    <TableRow>
      <TableCell
        colSpan={colSpan}
        align="center"
        sx={{
          py: 8,
          height: 200,
          minHeight: 200,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
          }}
        >
          {loading ? (
            <CircularProgress size={32} />
          ) : (
            <Typography variant="body1" color="text.secondary">
              {message}
            </Typography>
          )}
        </Box>
      </TableCell>
    </TableRow>
  );
};

export default EmptyTableRow;
