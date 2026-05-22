import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { GridOn as GridOnIcon, Add as AddIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

interface SpreadsheetEmptyStateProps {
  onCreateNew: () => void;
}

const SpreadsheetEmptyState: React.FC<SpreadsheetEmptyStateProps> = ({
  onCreateNew,
}) => {
  const { t } = useTranslation();

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: 10,
        gap: 2,
      }}
    >
      <Box
        sx={{
          width: 120,
          height: 120,
          borderRadius: '50%',
          bgcolor: 'action.hover',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mb: 1,
        }}
      >
        <GridOnIcon
          sx={{ fontSize: 56, color: 'primary.main', opacity: 0.6 }}
        />
      </Box>

      <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 500 }}>
        {t('spreadsheets.emptyTitle')}
      </Typography>

      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ maxWidth: 360, textAlign: 'center' }}
      >
        {t(
          'spreadsheets.emptyDescription')}
      </Typography>

      <Button
        variant="contained"
        startIcon={<AddIcon />}
        onClick={onCreateNew}
        size="large"
        sx={{ mt: 1, borderRadius: 2, textTransform: 'none', px: 4 }}
      >
        {t('spreadsheets.createNew')}
      </Button>
    </Box>
  );
};

export default SpreadsheetEmptyState;
