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
      <TableCell colSpan={colSpan} align="center" sx={{ py: 8, minHeight: 150 }}>
        {loading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <Typography variant="body1" color="text.secondary">
              {loadingMessage || t('common.loading')}
            </Typography>
            <CircularProgress size={24} />
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
